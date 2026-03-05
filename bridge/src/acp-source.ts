import chokidar, { type FSWatcher } from "chokidar";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { BridgeStateStore } from "./state-store.js";
import { AgentState } from "./types.js";

interface AcpSession {
  schema: string;
  acpx_record_id: string;
  agent_command: string;
  name: string;
  created_at: string;
  last_used_at: string;
  closed: boolean;
  closed_at?: string;
  cwd?: string;
  cumulative_token_usage?: Record<string, unknown>;
}

function detectContractorType(agentCommand: string): string {
  const cmd = agentCommand.toLowerCase();
  if (cmd.includes("codex")) return "Codex";
  if (cmd.includes("claude")) return "Claude";
  if (cmd.includes("gemini")) return "Gemini";
  if (cmd.includes("opencode")) return "OpenCode";
  if (cmd.includes("kimi")) return "Kimi";
  return "ACP";
}

function contractorDisplayName(type: string, sessionName: string): string {
  // "agent:codex:acp:uuid" → "Codex (uuid short)"
  const uuidMatch = sessionName.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  const short = uuidMatch ? uuidMatch[1].slice(0, 8) : sessionName.slice(-8);
  return `${type} (${short})`;
}

export class AcpSource {
  private watcher: FSWatcher | null = null;
  // Track which acpx_record_id maps to which bridge agent id
  private activeContractors = new Map<string, string>();

  constructor(
    private readonly store: BridgeStateStore,
    private readonly sessionsDir: string,
  ) {}

  async start(): Promise<void> {
    // Initial scan
    await this.scanExisting();

    // Watch for changes
    const pattern = path.join(this.sessionsDir, "*.json");
    this.watcher = chokidar.watch(pattern, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    this.watcher.on("add", (fp) => this.handleFile(fp));
    this.watcher.on("change", (fp) => this.handleFile(fp));
    this.watcher.on("unlink", (fp) => this.handleRemove(fp));

    this.store.pushEvent("ACP session watcher started (real files).");
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
    this.store.pushEvent("ACP session watcher stopped.");
  }

  private async scanExisting(): Promise<void> {
    try {
      const files = await readdir(this.sessionsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      for (const f of jsonFiles) {
        await this.handleFile(path.join(this.sessionsDir, f));
      }
    } catch {
      // Directory might not exist yet
      this.store.pushEvent("ACP sessions directory not found, watching for creation.");
    }
  }

  private async handleFile(filePath: string): Promise<void> {
    try {
      const raw = await readFile(filePath, "utf-8");
      const session = JSON.parse(raw) as AcpSession;

      if (session.schema !== "acpx.session.v1") return;

      const recordId = session.acpx_record_id;
      const type = detectContractorType(session.agent_command);
      const agentId = `acp-${recordId}`;

      if (session.closed) {
        // Remove if we were tracking it
        if (this.activeContractors.has(recordId)) {
          const name = contractorDisplayName(type, session.name);
          this.store.removeAgent(agentId, `${name} session completed.`);
          this.activeContractors.delete(recordId);
        }
        return;
      }

      // Active session
      const name = contractorDisplayName(type, session.name);
      const now = Date.now();
      const lastUsed = new Date(session.last_used_at).getTime();
      const age = now - lastUsed;

      let status: "idle" | "thinking" | "working" = "working";
      if (age > 5 * 60_000) status = "idle";
      else if (age > 30_000) status = "thinking";

      const agent: AgentState = {
        id: agentId,
        name,
        type: "contractor",
        status,
        connections: [],
        model: type.toLowerCase(),
        lastActivity: session.last_used_at,
      };

      const isNew = !this.activeContractors.has(recordId);
      this.activeContractors.set(recordId, agentId);
      this.store.upsertAgent(
        agent,
        isNew ? `${name} spawned as contractor.` : undefined,
      );
    } catch {
      // Skip malformed files
    }
  }

  private handleRemove(filePath: string): void {
    // Find by filename → record ID
    const basename = path.basename(filePath, ".json");
    for (const [recordId, agentId] of this.activeContractors) {
      if (recordId === basename) {
        this.store.removeAgent(agentId, `ACP session file removed.`);
        this.activeContractors.delete(recordId);
        return;
      }
    }
  }
}
