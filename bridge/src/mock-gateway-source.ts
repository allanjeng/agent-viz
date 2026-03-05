import { PERSISTENT_AGENTS, pickNextStatus } from "./mock-data.js";
import { BridgeStateStore } from "./state-store.js";
import { AgentState } from "./types.js";

function pickDistinctPair(ids: string[]): [string, string] | null {
  if (ids.length < 2) {
    return null;
  }

  const firstIndex = Math.floor(Math.random() * ids.length);
  let secondIndex = Math.floor(Math.random() * ids.length);

  if (secondIndex === firstIndex) {
    secondIndex = (secondIndex + 1) % ids.length;
  }

  return [ids[firstIndex], ids[secondIndex]];
}

export class MockGatewaySource {
  private timer: NodeJS.Timeout | null = null;

  private tickCount = 0;

  constructor(
    private readonly store: BridgeStateStore,
    private readonly intervalMs = 2500,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.store.pushEvent("Mock gateway polling started.");
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.store.pushEvent("Mock gateway polling stopped.");
  }

  private poll(): void {
    this.tickCount += 1;

    for (const persistent of PERSISTENT_AGENTS) {
      const existing = this.store.getAgent(persistent.id);

      if (!existing) {
        this.store.upsertAgent(persistent);
        continue;
      }

      this.store.patchAgent({
        id: existing.id,
        status: pickNextStatus(existing.status),
      });
    }

    this.updateConnections();

    if (this.tickCount % 4 === 0) {
      const workingCount = this.store.listAgents().filter((agent) => agent.status === "working").length;
      this.store.pushEvent(`Gateway pulse: ${workingCount} agent${workingCount === 1 ? "" : "s"} actively working.`);
    }
  }

  private updateConnections(): void {
    const agents = this.store.listAgents();
    const linkMap = new Map<string, Set<string>>();

    for (const agent of agents) {
      linkMap.set(agent.id, new Set<string>());
    }

    const talkers = agents
      .filter((agent) => agent.status === "thinking" || agent.status === "working")
      .map((agent) => agent.id);

    const linkCount = Math.min(3, Math.floor(Math.random() * 3) + (talkers.length > 1 ? 1 : 0));

    for (let index = 0; index < linkCount; index += 1) {
      const pair = pickDistinctPair(talkers);
      if (!pair) {
        break;
      }

      const [fromId, toId] = pair;
      linkMap.get(fromId)?.add(toId);
      linkMap.get(toId)?.add(fromId);
    }

    for (const agent of agents) {
      const connections = [...(linkMap.get(agent.id) ?? [])].sort();
      this.store.patchAgent({ id: agent.id, connections });
    }
  }
}
