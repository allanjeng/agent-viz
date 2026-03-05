import { AgentPatch, AgentState, BridgeEvent, DashboardSnapshot } from "./types.js";

type SnapshotListener = (snapshot: DashboardSnapshot) => void;

const MAX_EVENTS = 40;
const PERSISTENT_ORDER = ["nexus", "pivot", "aegis", "researcher"];

function dedupeConnections(connections: string[]): string[] {
  return [...new Set(connections)].filter(Boolean).sort();
}

function cloneAgent(agent: AgentState): AgentState {
  return {
    ...agent,
    connections: [...agent.connections],
  };
}

function agentsEqual(a: AgentState, b: AgentState): boolean {
  if (a.id !== b.id || a.name !== b.name || a.type !== b.type || a.status !== b.status) {
    return false;
  }

  if (a.connections.length !== b.connections.length) {
    return false;
  }

  for (let index = 0; index < a.connections.length; index += 1) {
    if (a.connections[index] !== b.connections[index]) {
      return false;
    }
  }

  return true;
}

function sortAgents(a: AgentState, b: AgentState): number {
  if (a.type !== b.type) {
    return a.type === "persistent" ? -1 : 1;
  }

  if (a.type === "persistent" && b.type === "persistent") {
    return PERSISTENT_ORDER.indexOf(a.id) - PERSISTENT_ORDER.indexOf(b.id);
  }

  return a.name.localeCompare(b.name);
}

function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class BridgeStateStore {
  private readonly agents = new Map<string, AgentState>();

  private readonly events: BridgeEvent[] = [];

  private readonly listeners = new Set<SnapshotListener>();

  constructor(initialAgents: AgentState[]) {
    for (const agent of initialAgents) {
      this.agents.set(agent.id, {
        ...agent,
        connections: dedupeConnections(agent.connections),
      });
    }

    this.pushEvent("Bridge initialized with mock persistent agents.", false);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getAgent(id: string): AgentState | undefined {
    const existing = this.agents.get(id);

    return existing ? cloneAgent(existing) : undefined;
  }

  listAgents(): AgentState[] {
    return this.snapshot().agents;
  }

  upsertAgent(agent: AgentState, message?: string): boolean {
    const normalized: AgentState = {
      ...agent,
      connections: dedupeConnections(agent.connections),
    };

    const existing = this.agents.get(agent.id);
    if (existing && agentsEqual(existing, normalized)) {
      return false;
    }

    this.agents.set(agent.id, normalized);

    if (message) {
      this.pushEvent(message, false);
    }

    this.emit();

    return true;
  }

  patchAgent(patch: AgentPatch, message?: string): boolean {
    const existing = this.agents.get(patch.id);
    if (!existing) {
      return false;
    }

    const merged: AgentState = {
      id: existing.id,
      name: patch.name ?? existing.name,
      type: patch.type ?? existing.type,
      status: patch.status ?? existing.status,
      connections: dedupeConnections(patch.connections ?? existing.connections),
    };

    if (agentsEqual(existing, merged)) {
      return false;
    }

    this.agents.set(patch.id, merged);

    if (message) {
      this.pushEvent(message, false);
    }

    this.emit();

    return true;
  }

  removeAgent(id: string, message?: string): boolean {
    const removed = this.agents.delete(id);
    if (!removed) {
      return false;
    }

    for (const [agentId, agent] of this.agents.entries()) {
      if (!agent.connections.includes(id)) {
        continue;
      }

      const filtered = agent.connections.filter((connectionId) => connectionId !== id);
      this.agents.set(agentId, {
        ...agent,
        connections: filtered,
      });
    }

    if (message) {
      this.pushEvent(message, false);
    }

    this.emit();

    return true;
  }

  pushEvent(message: string, emit = true): void {
    this.events.unshift({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      message,
    });

    if (this.events.length > MAX_EVENTS) {
      this.events.length = MAX_EVENTS;
    }

    if (emit) {
      this.emit();
    }
  }

  snapshot(): DashboardSnapshot {
    const agents = [...this.agents.values()].sort(sortAgents).map(cloneAgent);

    return {
      agents,
      stats: {
        sessionCount: agents.length,
        activeContractors: agents.filter((agent) => agent.type === "contractor").length,
        updatedAt: new Date().toISOString(),
      },
      events: this.events.map((event) => ({ ...event })),
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
