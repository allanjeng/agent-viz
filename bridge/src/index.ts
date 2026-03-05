import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AcpSource } from "./acp-source.js";
import { GatewaySource } from "./gateway-source.js";
import { MockAcpSource } from "./mock-acp-source.js";
import { PERSISTENT_AGENTS } from "./mock-data.js";
import { MockGatewaySource } from "./mock-gateway-source.js";
import { BridgeStateStore } from "./state-store.js";
import { BridgeWsServer } from "./ws-server.js";

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3002);
const mockMode = process.env.MOCK_MODE === "true";

async function readAuthToken(): Promise<string> {
  if (process.env.OPENCLAW_AUTH_TOKEN) {
    return process.env.OPENCLAW_AUTH_TOKEN;
  }
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    const token = config?.gateway?.auth?.token;
    if (token) return token;
  } catch {
    // fall through
  }
  throw new Error(
    "No auth token found. Set OPENCLAW_AUTH_TOKEN or configure gateway.auth.token in ~/.openclaw/openclaw.json",
  );
}

async function main(): Promise<void> {
  // In real mode, gateway source will populate agents; in mock mode, seed them
  const store = new BridgeStateStore(mockMode ? PERSISTENT_AGENTS : []);
  const wsServer = new BridgeWsServer(store, bridgePort);

  let gatewaySource: { start(): void; stop(): void };
  let acpSource: { start(): void | Promise<void>; stop(): void };

  if (mockMode) {
    console.log("[bridge] Starting in MOCK mode.");
    gatewaySource = new MockGatewaySource(store);
    acpSource = new MockAcpSource(store);
  } else {
    console.log("[bridge] Starting with real OpenClaw data sources.");
    const apiUrl =
      process.env.OPENCLAW_API_URL ?? "http://127.0.0.1:18789";
    const authToken = await readAuthToken();
    const sessionsDir =
      process.env.ACPX_SESSIONS_DIR ??
      path.join(os.homedir(), ".acpx", "sessions");

    gatewaySource = new GatewaySource(store, apiUrl, authToken);
    acpSource = new AcpSource(store, sessionsDir);
  }

  wsServer.start();
  gatewaySource.start();
  await acpSource.start();

  console.log("[bridge] OpenClaw state bridge started.");
  console.log(
    `[bridge] mode: ${mockMode ? "mock" : "real"} | ws://localhost:${bridgePort}`,
  );

  function shutdown(): void {
    console.log("[bridge] shutting down...");
    gatewaySource.stop();
    acpSource.stop();
    wsServer.stop();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[bridge] Fatal:", err);
  process.exit(1);
});
