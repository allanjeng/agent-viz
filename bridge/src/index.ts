import { MockAcpSource } from "./mock-acp-source.js";
import { MockGatewaySource } from "./mock-gateway-source.js";
import { PERSISTENT_AGENTS } from "./mock-data.js";
import { BridgeStateStore } from "./state-store.js";
import { BridgeWsServer } from "./ws-server.js";

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3002);

const store = new BridgeStateStore(PERSISTENT_AGENTS);
const wsServer = new BridgeWsServer(store, bridgePort);
const gatewaySource = new MockGatewaySource(store);
const acpSource = new MockAcpSource(store);

wsServer.start();
gatewaySource.start();
acpSource.start();

console.log("[bridge] mock OpenClaw state bridge started.");
console.log("[bridge] data sources: mock gateway poller + mock ACP session watcher.");

function shutdown(): void {
  console.log("[bridge] shutting down...");
  gatewaySource.stop();
  acpSource.stop();
  wsServer.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
