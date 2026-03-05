export type AgentType = "persistent" | "contractor";
export type AgentStatus = "idle" | "thinking" | "working" | "error";

export interface AgentState {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  connections: string[];
  model?: string;
  totalTokens?: number;
  sessionCount?: number;
  lastActivity?: string;
}

export interface AgentPatch extends Partial<Omit<AgentState, "id">> {
  id: string;
}

export interface BridgeEvent {
  id: string;
  timestamp: string;
  message: string;
}

export interface DashboardSnapshot {
  agents: AgentState[];
  stats: {
    sessionCount: number;
    activeContractors: number;
    updatedAt: string;
  };
  events: BridgeEvent[];
}

export interface BridgeStateMessage {
  type: "state";
  data: DashboardSnapshot;
}
