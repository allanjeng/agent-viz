import { BridgeStateStore } from "./state-store.js";
import { AgentState, AgentStatus } from "./types.js";

interface GatewaySession {
  key: string;
  kind: string;
  channel: string;
  displayName: string;
  updatedAt: number;
  sessionId: string;
  model?: string;
  totalTokens?: number;
  abortedLastRun?: boolean;
  label?: string;
}

interface InvokeResponse {
  ok: boolean;
  result?: {
    details?: {
      count: number;
      sessions: GatewaySession[];
    };
  };
}

const AGENT_MAP: Record<string, string> = {
  main: "Nexus",
  pivot: "Pivot",
  aegis: "Aegis",
  researcher: "Researcher",
};

const PERSISTENT_IDS = new Set(Object.keys(AGENT_MAP));

function extractAgentId(sessionKey: string): string | null {
  // "agent:main:discord:channel:123" → "main"
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
}

function extractChannelId(sessionKey: string): string | null {
  // "agent:main:discord:channel:123456" → "123456"
  const match = sessionKey.match(/:channel:(\d+)$/);
  return match ? match[1] : null;
}

function deriveStatus(sessions: GatewaySession[]): AgentStatus {
  const now = Date.now();
  let hasRecentError = false;
  let hasWorking = false;
  let hasThinking = false;

  for (const s of sessions) {
    const age = now - s.updatedAt;
    if (s.abortedLastRun && age < 5 * 60_000) {
      hasRecentError = true;
    }
    if (age < 30_000) {
      hasWorking = true;
    } else if (age < 5 * 60_000) {
      hasThinking = true;
    }
  }

  if (hasRecentError) return "error";
  if (hasWorking) return "working";
  if (hasThinking) return "thinking";
  return "idle";
}

export class GatewaySource {
  private timer: NodeJS.Timeout | null = null;
  private lastAgentStatus = new Map<string, AgentStatus>();

  constructor(
    private readonly store: BridgeStateStore,
    private readonly apiUrl: string,
    private readonly authToken: string,
    private readonly intervalMs = 5000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.store.pushEvent("Gateway polling started (real API).");
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.store.pushEvent("Gateway polling stopped.");
  }

  private async poll(): Promise<void> {
    try {
      const sessions = await this.fetchSessions();
      this.processSessionData(sessions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.store.pushEvent(`Gateway poll error: ${msg}`);
    }
  }

  private async fetchSessions(): Promise<GatewaySession[]> {
    const res = await fetch(`${this.apiUrl}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        tool: "sessions_list",
        params: { limit: 100, messageLimit: 0 },
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as InvokeResponse;
    if (!data.ok || !data.result?.details?.sessions) {
      throw new Error("Invalid API response");
    }

    return data.result.details.sessions;
  }

  private processSessionData(sessions: GatewaySession[]): void {
    // Group sessions by agent
    const agentSessions = new Map<string, GatewaySession[]>();
    for (const s of sessions) {
      const agentId = extractAgentId(s.key);
      if (!agentId) continue;
      const list = agentSessions.get(agentId) ?? [];
      list.push(s);
      agentSessions.set(agentId, list);
    }

    // Build connection map: agents sharing the same Discord channel
    const channelAgents = new Map<string, Set<string>>();
    for (const s of sessions) {
      const agentId = extractAgentId(s.key);
      const channelId = extractChannelId(s.key);
      if (!agentId || !channelId || !PERSISTENT_IDS.has(agentId)) continue;
      const set = channelAgents.get(channelId) ?? new Set();
      set.add(agentId);
      channelAgents.set(channelId, set);
    }

    // Derive connections per agent
    const connections = new Map<string, Set<string>>();
    for (const [, agents] of channelAgents) {
      if (agents.size < 2) continue;
      const arr = [...agents];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const setA = connections.get(arr[i]) ?? new Set();
          setA.add(arr[j]);
          connections.set(arr[i], setA);
          const setB = connections.get(arr[j]) ?? new Set();
          setB.add(arr[i]);
          connections.set(arr[j], setB);
        }
      }
    }

    // Upsert persistent agents
    for (const [agentId, name] of Object.entries(AGENT_MAP)) {
      const sessionsForAgent = agentSessions.get(agentId) ?? [];
      const status = deriveStatus(sessionsForAgent);
      const totalTokens = sessionsForAgent.reduce(
        (sum, s) => sum + (s.totalTokens ?? 0),
        0,
      );

      // Most recent session
      const mostRecent = sessionsForAgent.sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )[0];

      const agentConnections = [...(connections.get(agentId) ?? [])].sort();

      const agent: AgentState = {
        id: agentId,
        name,
        type: "persistent",
        status,
        connections: agentConnections,
        model: mostRecent?.model,
        totalTokens,
        sessionCount: sessionsForAgent.length,
        lastActivity: mostRecent
          ? new Date(mostRecent.updatedAt).toISOString()
          : undefined,
      };

      // Log status changes
      const prev = this.lastAgentStatus.get(agentId);
      const eventMsg =
        prev && prev !== status
          ? `${name} status: ${prev} → ${status}`
          : undefined;
      this.lastAgentStatus.set(agentId, status);

      this.store.upsertAgent(agent, eventMsg);
    }
  }
}
