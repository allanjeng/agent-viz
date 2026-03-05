import { OfficeCanvas } from "./components/OfficeCanvas";
import { useBridgeState } from "./hooks/useBridgeState";
import { AgentState } from "./types";

function formatTime(isoTime: string): string {
  const timestamp = new Date(isoTime);

  if (Number.isNaN(timestamp.getTime())) {
    return "--:--:--";
  }

  return timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTokens(n?: number): string {
  if (n == null || n === 0) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function archetypeFor(agent: AgentState): string {
  if (agent.type === "persistent") {
    if (agent.id === "nexus" || agent.id === "pivot" || agent.id === "aegis" || agent.id === "researcher") {
      return agent.id;
    }
    return "nexus";
  }

  if (agent.id.startsWith("claude-")) {
    return "claude";
  }

  if (agent.id.startsWith("gemini-")) {
    return "gemini";
  }

  return "codex";
}

export default function App(): JSX.Element {
  const { snapshot, connectionState, bridgeUrl } = useBridgeState();

  const persistent = snapshot.agents.filter((agent) => agent.type === "persistent");
  const contractors = snapshot.agents.filter((agent) => agent.type === "contractor");

  return (
    <div className="dashboard-shell">
      <main className="office-pane">
        <div className="pane-header">
          <div>
            <h1 className="dashboard-title">OpenClaw Agent Viz</h1>
            <p className="dashboard-subtitle">Cozy warm operations office</p>
          </div>
          <span className={`connection-pill ${connectionState}`}>{connectionState}</span>
        </div>
        <OfficeCanvas agents={snapshot.agents} />
      </main>

      <aside className="side-pane">
        <section className="metric-grid">
          <article>
            <h2>Sessions</h2>
            <p>{snapshot.stats.sessionCount}</p>
          </article>
          <article>
            <h2>Persistent</h2>
            <p>{persistent.length}</p>
          </article>
          <article>
            <h2>Contractors</h2>
            <p>{contractors.length}</p>
          </article>
        </section>

        <section className="agent-roster">
          <h2>Agents</h2>
          {persistent.map((agent) => (
            <div key={agent.id} className={`agent-card status-${agent.status}`}>
              <div className="agent-card-header">
                <div className="agent-card-identity">
                  <span className={`agent-avatar ${archetypeFor(agent)}`} />
                  <div>
                    <span className="agent-name">{agent.name}</span>
                    <span className="agent-role">persistent</span>
                  </div>
                </div>
                <div className="agent-status-wrap">
                  <span className={`status-dot ${agent.status}`} />
                  <span className="status-label">{agent.status}</span>
                </div>
              </div>
              <div className="agent-card-meta">
                {agent.model && <span className="tag model">{agent.model}</span>}
                {agent.sessionCount != null && <span className="tag">{agent.sessionCount} sessions</span>}
                {agent.totalTokens != null && <span className="tag">{formatTokens(agent.totalTokens)} tokens</span>}
                <span className="tag time">{timeAgo(agent.lastActivity)}</span>
              </div>
            </div>
          ))}
          {contractors.length > 0 && (
            <>
              <h3>Contractors</h3>
              {contractors.map((agent) => (
                <div key={agent.id} className={`agent-card contractor status-${agent.status}`}>
                  <div className="agent-card-header">
                    <div className="agent-card-identity">
                      <span className={`agent-avatar ${archetypeFor(agent)}`} />
                      <div>
                        <span className="agent-name">{agent.name}</span>
                        <span className="agent-role">contractor</span>
                      </div>
                    </div>
                    <div className="agent-status-wrap">
                      <span className={`status-dot ${agent.status}`} />
                      <span className="status-label">{agent.status}</span>
                    </div>
                  </div>
                  <div className="agent-card-meta">
                    <span className="tag time">{timeAgo(agent.lastActivity)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="bridge-meta">
          <h2>Bridge</h2>
          <p>{bridgeUrl}</p>
          <p>Last update: {formatTime(snapshot.stats.updatedAt)}</p>
        </section>

        <section className="event-log">
          <h2>Recent Events</h2>
          <ul>
            {snapshot.events.slice(0, 12).map((event) => (
              <li key={event.id}>
                <time>{formatTime(event.timestamp)}</time>
                <span>{event.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
