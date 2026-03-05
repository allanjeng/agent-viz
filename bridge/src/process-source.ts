import { execFile } from "node:child_process";

import { BridgeStateStore } from "./state-store.js";
import { AgentState } from "./types.js";

type ContractorKind = "codex" | "claude" | "gemini" | "opencode";

interface MatchedProcess {
  pid: number;
  kind: ContractorKind;
}

interface ProcessGroup {
  kind: ContractorKind;
  groupPid: number;
}

const PROCESS_SCAN_PATTERNS = [
  "codex-acp",
  "codex exec",
  "codex --yolo",
  "claude-agent-acp",
  "@zed-industries/claude-agent",
  "gemini",
  "opencode",
];

const KIND_NAME: Record<ContractorKind, string> = {
  codex: "Codex",
  claude: "Claude",
  gemini: "Gemini",
  opencode: "OpenCode",
};

function parsePgrepLine(line: string): { pid: number; command: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  const pid = Number(match[1]);
  if (!Number.isInteger(pid) || pid <= 0) return null;

  return {
    pid,
    command: match[2],
  };
}

function shouldExcludeProcess(command: string): boolean {
  const lower = command.toLowerCase();

  if (lower.includes("codex.app")) return true;
  if (lower.includes("sparkle/updater")) return true;
  if (/\bcodex\b.*\bapp-server\b/.test(lower)) return true;
  if (/\bpgrep\b/.test(lower)) return true;

  return false;
}

function readExitCode(error: NodeJS.ErrnoException): number | null {
  const code = (error as { code?: unknown }).code;
  if (typeof code === "number") return code;
  if (typeof code === "string") {
    const parsed = Number(code);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function detectContractorKind(command: string): ContractorKind | null {
  const lower = command.toLowerCase();

  if (
    lower.includes("codex-acp") ||
    lower.includes("codex exec") ||
    lower.includes("codex --yolo")
  ) {
    return "codex";
  }

  if (
    lower.includes("claude-agent-acp") ||
    lower.includes("@zed-industries/claude-agent")
  ) {
    return "claude";
  }

  if (lower.includes("gemini")) {
    return "gemini";
  }

  if (lower.includes("opencode")) {
    return "opencode";
  }

  return null;
}

function toAgent(group: ProcessGroup): AgentState {
  const kindName = KIND_NAME[group.kind];

  return {
    id: `proc-${group.kind}-${group.groupPid}`,
    name: `${kindName} (${group.groupPid})`,
    type: "contractor",
    status: "working",
    connections: ["nexus"],
    model: group.kind,
    lastActivity: new Date().toISOString(),
  };
}

export class ProcessSource {
  private timer: NodeJS.Timeout | null = null;
  private readonly activeContractors = new Map<string, string>();
  private pgrepMissing = false;
  private scanInFlight = false;
  private lastErrorMessage: string | null = null;

  constructor(
    private readonly store: BridgeStateStore,
    private readonly intervalMs = 3000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.store.pushEvent("Process scanner started.");
    void this.scan();
    this.timer = setInterval(() => {
      void this.scan();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.store.pushEvent("Process scanner stopped.");
  }

  private async scan(): Promise<void> {
    if (this.scanInFlight || this.pgrepMissing) {
      return;
    }

    this.scanInFlight = true;

    try {
      const processes = await this.scanProcesses();
      const groups = await this.groupProcesses(processes);
      this.reconcile(groups);
      this.lastErrorMessage = null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== this.lastErrorMessage) {
        this.store.pushEvent(`Process scanner error: ${msg}`);
        this.lastErrorMessage = msg;
      }
    } finally {
      this.scanInFlight = false;
    }
  }

  private async scanProcesses(): Promise<MatchedProcess[]> {
    const byPid = new Map<number, MatchedProcess>();

    for (const pattern of PROCESS_SCAN_PATTERNS) {
      const lines = await this.runPgrep(pattern);

      for (const line of lines) {
        const parsed = parsePgrepLine(line);
        if (!parsed) continue;
        if (shouldExcludeProcess(parsed.command)) continue;

        const kind = detectContractorKind(parsed.command);
        if (!kind) continue;

        byPid.set(parsed.pid, {
          pid: parsed.pid,
          kind,
        });
      }
    }

    return [...byPid.values()];
  }

  private async runPgrep(pattern: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      execFile(
        "pgrep",
        ["-lf", pattern],
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            const errno = error as NodeJS.ErrnoException;
            if (readExitCode(errno) === 1) {
              resolve([]);
              return;
            }

            if (errno.code === "ENOENT") {
              if (!this.pgrepMissing) {
                this.store.pushEvent("Process scanner unavailable: pgrep not found.");
              }
              this.pgrepMissing = true;
              if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
              }
              resolve([]);
              return;
            }

            reject(error);
            return;
          }

          const lines = stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          resolve(lines);
        },
      );
    });
  }

  private async groupProcesses(processes: MatchedProcess[]): Promise<ProcessGroup[]> {
    if (processes.length === 0) return [];

    const processGroupByPid = await this.lookupProcessGroups(
      processes.map((process) => process.pid),
    );
    const grouped = new Map<string, ProcessGroup>();

    for (const process of processes) {
      const groupPid = processGroupByPid.get(process.pid) ?? process.pid;
      const key = `${process.kind}:${groupPid}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          kind: process.kind,
          groupPid,
        });
      }
    }

    return [...grouped.values()];
  }

  private async lookupProcessGroups(pids: number[]): Promise<Map<number, number>> {
    if (pids.length === 0) return new Map();

    return new Promise((resolve, reject) => {
      execFile(
        "ps",
        ["-o", "pid=,pgid=", "-p", pids.join(",")],
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            const errno = error as NodeJS.ErrnoException;
            if (readExitCode(errno) !== 1) {
              reject(error);
              return;
            }
          }

          const mapping = new Map<number, number>();
          const lines = stdout.split("\n");

          for (const line of lines) {
            const match = line.trim().match(/^(\d+)\s+(\d+)$/);
            if (!match) continue;

            const pid = Number(match[1]);
            const pgid = Number(match[2]);
            if (!Number.isInteger(pid) || !Number.isInteger(pgid)) continue;

            mapping.set(pid, pgid);
          }

          resolve(mapping);
        },
      );
    });
  }

  private reconcile(groups: ProcessGroup[]): void {
    const nextAgents = new Map<string, AgentState>();

    for (const group of groups) {
      const agent = toAgent(group);
      nextAgents.set(agent.id, agent);
    }

    for (const agent of nextAgents.values()) {
      const isNew = !this.activeContractors.has(agent.id);
      this.store.upsertAgent(
        agent,
        isNew ? `${agent.name} detected as live contractor process.` : undefined,
      );
      this.activeContractors.set(agent.id, agent.name);
    }

    for (const [agentId, name] of this.activeContractors.entries()) {
      if (nextAgents.has(agentId)) continue;
      this.store.removeAgent(agentId, `${name} process exited.`);
      this.activeContractors.delete(agentId);
    }
  }
}
