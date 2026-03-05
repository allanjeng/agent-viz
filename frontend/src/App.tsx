import { OfficeCanvas } from "./components/OfficeCanvas";
import { useBridgeState } from "./hooks/useBridgeState";

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

export default function App(): JSX.Element {
  const { snapshot, connectionState, bridgeUrl } = useBridgeState();

  const persistent = snapshot.agents.filter((agent) => agent.type === "persistent");
  const contractors = snapshot.agents.filter((agent) => agent.type === "contractor");

  return (
    <div className="dashboard-shell">
      <main className="office-pane">
        <div className="pane-header">
          <h1>OpenClaw Agent Viz</h1>
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
