import chokidar, { type FSWatcher } from "chokidar";
import os from "node:os";
import path from "node:path";

import {
  contractorName,
  pickContractorKind,
  pickNextStatus,
  randomPersistentId,
} from "./mock-data.js";
import { BridgeStateStore } from "./state-store.js";
import { AgentState, AgentStatus } from "./types.js";

const SPAWN_STATUSES: AgentStatus[] = ["idle", "thinking", "working"];

export class MockAcpSource {
  private timer: NodeJS.Timeout | null = null;

  private watcher: FSWatcher | null = null;

  private nextId = 1;

  constructor(
    private readonly store: BridgeStateStore,
    private readonly intervalMs = 4200,
    private readonly maxContractors = 6,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.watchSessionFiles();
    this.store.pushEvent("Mock ACP watcher started.");
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }

    this.store.pushEvent("Mock ACP watcher stopped.");
  }

  private watchSessionFiles(): void {
    const pattern = path.join(os.homedir(), ".acpx", "sessions", "*.json");

    this.watcher = chokidar.watch(pattern, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on("add", (filePath) => {
      this.store.pushEvent(`[mock] ACP session file added: ${path.basename(filePath)}`);
    });

    this.watcher.on("change", (filePath) => {
      this.store.pushEvent(`[mock] ACP session file changed: ${path.basename(filePath)}`);
    });

    this.watcher.on("unlink", (filePath) => {
      this.store.pushEvent(`[mock] ACP session file removed: ${path.basename(filePath)}`);
    });
  }

  private tick(): void {
    const contractors = this.store.listAgents().filter((agent) => agent.type === "contractor");
    const roll = Math.random();

    if (contractors.length === 0 || (roll < 0.36 && contractors.length < this.maxContractors)) {
      this.spawnContractor();
      return;
    }

    if (roll < 0.56 && contractors.length > 0) {
      const target = contractors[Math.floor(Math.random() * contractors.length)];
      this.despawnContractor(target);
      return;
    }

    if (contractors.length > 0) {
      const target = contractors[Math.floor(Math.random() * contractors.length)];
      this.updateContractor(target);
    }
  }

  private spawnContractor(): void {
    const idNumber = this.nextId;
    const kind = pickContractorKind();

    this.nextId += 1;

    const status = SPAWN_STATUSES[Math.floor(Math.random() * SPAWN_STATUSES.length)];
    const connections = status === "idle" ? [] : [randomPersistentId()];

    this.store.upsertAgent(
      {
        id: `${kind}-${idNumber}`,
        name: contractorName(kind, idNumber),
        type: "contractor",
        status,
        connections,
      },
      `${contractorName(kind, idNumber)} connected as a contractor.`,
    );
  }

  private despawnContractor(agent: AgentState): void {
    this.store.removeAgent(agent.id, `${agent.name} completed and disconnected.`);
  }

  private updateContractor(agent: AgentState): void {
    const status = pickNextStatus(agent.status);
    const connections = status === "idle" || status === "error" ? [] : [randomPersistentId()];

    const shouldLog = Math.random() < 0.45;

    this.store.patchAgent(
      {
        id: agent.id,
        status,
        connections,
      },
      shouldLog ? `${agent.name} is now ${status}.` : undefined,
    );
  }
}
