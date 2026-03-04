# agent-viz

Real-time pixel-art visualization dashboard for OpenClaw agent infrastructure.

Live dashboard that reflects actual OpenClaw state — persistent agents (Nexus, Pivot, Aegis, Researcher) as pixel-art characters, ACP-spawned sessions as temporary contractors, cross-talk lines, and audit feeds.

## Architecture

- **Bridge Service** — Node.js service that polls OpenClaw API + watches ACP session files, pushes state over WebSocket
- **Frontend** — React + PixiJS pixel-art office with live agent state rendering

## Data Sources

- OpenClaw gateway API (sessions, status)
- `~/.acpx/sessions/*.json` (ACP session state)
- Gateway logs (spawn/completion/error events)

## Status

🚧 Prototype — under active development

## License

MIT
