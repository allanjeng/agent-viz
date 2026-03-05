import { AgentState, AgentStatus } from "./types.js";

export const PERSISTENT_AGENTS: AgentState[] = [
  {
    id: "nexus",
    name: "Nexus",
    type: "persistent",
    status: "idle",
    connections: [],
  },
  {
    id: "pivot",
    name: "Pivot",
    type: "persistent",
    status: "idle",
    connections: [],
  },
  {
    id: "aegis",
    name: "Aegis",
    type: "persistent",
    status: "idle",
    connections: [],
  },
  {
    id: "researcher",
    name: "Researcher",
    type: "persistent",
    status: "idle",
    connections: [],
  },
];

const STATUS_WEIGHTS: Array<{ status: AgentStatus; weight: number }> = [
  { status: "idle", weight: 0.4 },
  { status: "thinking", weight: 0.3 },
  { status: "working", weight: 0.25 },
  { status: "error", weight: 0.05 },
];

const CONTRACTOR_KINDS = ["codex", "claude", "gemini"] as const;

export type ContractorKind = (typeof CONTRACTOR_KINDS)[number];

function weightedStatus(): AgentStatus {
  const target = Math.random();
  let cursor = 0;

  for (const option of STATUS_WEIGHTS) {
    cursor += option.weight;

    if (target <= cursor) {
      return option.status;
    }
  }

  return "idle";
}

export function pickNextStatus(current: AgentStatus): AgentStatus {
  if (Math.random() < 0.58) {
    if (current === "error" && Math.random() < 0.5) {
      return "idle";
    }

    return current;
  }

  return weightedStatus();
}

export function pickContractorKind(): ContractorKind {
  const index = Math.floor(Math.random() * CONTRACTOR_KINDS.length);

  return CONTRACTOR_KINDS[index];
}

export function contractorName(kind: ContractorKind, id: number): string {
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

  return `${title} session ${id}`;
}

export function randomPersistentId(): string {
  const index = Math.floor(Math.random() * PERSISTENT_AGENTS.length);

  return PERSISTENT_AGENTS[index].id;
}
