import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  Ticker,
} from "pixi.js";

import {
  CONTRACTOR_DESKS,
  deskToAgentPosition,
  ENTRY_POINT,
  OFFICE_HEIGHT_TILES,
  OFFICE_WIDTH_TILES,
  PERSISTENT_DESKS,
  TILE_SIZE,
} from "./layout";
import { AgentState, AgentStatus } from "../types";

type Pose = "idle" | "thinking" | "working" | "error";
type Archetype = "nexus" | "pivot" | "aegis" | "researcher" | "codex" | "claude" | "gemini";

type SheetWithTextures = {
  textures: Record<string, Texture>;
};

type AgentVisual = {
  agent: AgentState;
  sprite: Sprite;
  slotIndex: number | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  despawning: boolean;
  phase: number;
};

export class OfficeScene {
  private readonly host: HTMLElement;

  private app: Application | null = null;

  private backgroundLayer: Container | null = null;

  private connectionLayer: Graphics | null = null;

  private agentLayer: Container | null = null;

  private agentTextures: Record<string, Texture> = {};

  private tileTextures: Record<string, Texture> = {};

  private visuals = new Map<string, AgentVisual>();

  private pendingAgents: AgentState[] = [];

  private ready = false;

  private destroyed = false;

  constructor(host: HTMLElement) {
    this.host = host;
    void this.init();
  }

  setAgents(agents: AgentState[]): void {
    this.pendingAgents = agents.map((agent) => ({
      ...agent,
      connections: [...agent.connections],
    }));

    if (this.ready) {
      this.syncAgents(this.pendingAgents);
    }
  }

  destroy(): void {
    this.destroyed = true;

    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.app.destroy(true, { children: true });
      this.app = null;
    }

    this.visuals.clear();
    this.host.innerHTML = "";
  }

  private async init(): Promise<void> {
    const app = new Application();
    await app.init({
      width: OFFICE_WIDTH_TILES * TILE_SIZE,
      height: OFFICE_HEIGHT_TILES * TILE_SIZE,
      antialias: false,
      background: 0x7a8c85,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (this.destroyed) {
      app.destroy(true);
      return;
    }

    this.host.innerHTML = "";
    this.host.appendChild(app.canvas as HTMLCanvasElement);

    const backgroundLayer = new Container();
    const connectionLayer = new Graphics();
    const agentLayer = new Container();
    agentLayer.sortableChildren = true;

    app.stage.addChild(backgroundLayer);
    app.stage.addChild(connectionLayer);
    app.stage.addChild(agentLayer);

    this.app = app;
    this.backgroundLayer = backgroundLayer;
    this.connectionLayer = connectionLayer;
    this.agentLayer = agentLayer;

    const [agentSheet, tileSheet] = await Promise.all([
      Assets.load("/assets/agents.json") as Promise<SheetWithTextures>,
      Assets.load("/assets/tiles.json") as Promise<SheetWithTextures>,
    ]);

    if (this.destroyed) {
      return;
    }

    this.agentTextures = agentSheet.textures;
    this.tileTextures = tileSheet.textures;

    this.drawOffice();

    this.ready = true;
    this.syncAgents(this.pendingAgents);

    app.ticker.add(this.tick);
  }

  private drawOffice(): void {
    if (!this.backgroundLayer) {
      return;
    }

    this.backgroundLayer.removeChildren();

    for (let tileY = 0; tileY < OFFICE_HEIGHT_TILES; tileY += 1) {
      for (let tileX = 0; tileX < OFFICE_WIDTH_TILES; tileX += 1) {
        const floor = new Sprite(this.tile("floor"));
        floor.x = tileX * TILE_SIZE;
        floor.y = tileY * TILE_SIZE;
        this.backgroundLayer.addChild(floor);
      }
    }

    for (let tileX = 0; tileX < OFFICE_WIDTH_TILES; tileX += 1) {
      const topWall = new Sprite(this.tile("wall"));
      topWall.x = tileX * TILE_SIZE;
      topWall.y = 0;
      this.backgroundLayer.addChild(topWall);

      const bottomWall = new Sprite(this.tile("wall"));
      bottomWall.x = tileX * TILE_SIZE;
      bottomWall.y = (OFFICE_HEIGHT_TILES - 1) * TILE_SIZE;
      this.backgroundLayer.addChild(bottomWall);
    }

    for (let tileY = 1; tileY < OFFICE_HEIGHT_TILES - 1; tileY += 1) {
      const leftWall = new Sprite(this.tile("wall"));
      leftWall.x = 0;
      leftWall.y = tileY * TILE_SIZE;
      this.backgroundLayer.addChild(leftWall);

      const rightWall = new Sprite(this.tile("wall"));
      rightWall.x = (OFFICE_WIDTH_TILES - 1) * TILE_SIZE;
      rightWall.y = tileY * TILE_SIZE;
      this.backgroundLayer.addChild(rightWall);
    }

    const rug = new Sprite(this.tile("rug"));
    rug.x = 14 * TILE_SIZE;
    rug.y = 7 * TILE_SIZE;
    this.backgroundLayer.addChild(rug);

    const allDesks = [...Object.values(PERSISTENT_DESKS), ...CONTRACTOR_DESKS];

    for (const desk of allDesks) {
      const deskSprite = new Sprite(this.tile("desk"));
      deskSprite.x = desk.x * TILE_SIZE;
      deskSprite.y = desk.y * TILE_SIZE;
      this.backgroundLayer.addChild(deskSprite);

      const chairSprite = new Sprite(this.tile("chair"));
      chairSprite.x = desk.x * TILE_SIZE;
      chairSprite.y = (desk.y + 1) * TILE_SIZE;
      this.backgroundLayer.addChild(chairSprite);
    }

    const door = new Sprite(this.tile("door"));
    door.x = (OFFICE_WIDTH_TILES - 1) * TILE_SIZE;
    door.y = (OFFICE_HEIGHT_TILES - 2) * TILE_SIZE;
    this.backgroundLayer.addChild(door);
  }

  private syncAgents(agents: AgentState[]): void {
    if (!this.agentLayer) {
      return;
    }

    const incomingIds = new Set<string>();

    for (const agent of agents) {
      incomingIds.add(agent.id);

      let visual = this.visuals.get(agent.id);
      if (!visual) {
        visual = this.createVisual(agent);
        this.visuals.set(agent.id, visual);
        this.agentLayer.addChild(visual.sprite);
      }

      visual.agent = agent;
      visual.despawning = false;

      if (agent.type === "contractor") {
        if (visual.slotIndex === null) {
          visual.slotIndex = this.claimContractorSlot(agent.id);
        }

        const target = visual.slotIndex === null
          ? { x: ENTRY_POINT.x - 60, y: ENTRY_POINT.y - 80 }
          : deskToAgentPosition(CONTRACTOR_DESKS[visual.slotIndex]);

        visual.targetX = target.x;
        visual.targetY = target.y;
      } else {
        const target = this.persistentPosition(agent.id);
        visual.slotIndex = null;
        visual.targetX = target.x;
        visual.targetY = target.y;
      }
    }

    for (const [id, visual] of this.visuals) {
      if (incomingIds.has(id)) {
        continue;
      }

      if (visual.agent.type === "persistent") {
        continue;
      }

      visual.despawning = true;
      visual.targetX = ENTRY_POINT.x;
      visual.targetY = ENTRY_POINT.y;
    }
  }

  private createVisual(agent: AgentState): AgentVisual {
    const archetype = this.archetypeFor(agent);
    const sprite = new Sprite(this.texture(archetype, "idle"));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(2);

    const start = agent.type === "contractor"
      ? { x: ENTRY_POINT.x, y: ENTRY_POINT.y }
      : this.persistentPosition(agent.id);

    sprite.x = start.x;
    sprite.y = start.y;

    return {
      agent,
      sprite,
      slotIndex: null,
      x: start.x,
      y: start.y,
      targetX: start.x,
      targetY: start.y,
      despawning: false,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private readonly tick = (ticker: Ticker): void => {
    if (!this.agentLayer || !this.connectionLayer) {
      return;
    }

    const seconds = ticker.deltaMS / 1000;
    const now = performance.now() / 1000;

    for (const [id, visual] of this.visuals) {
      const speed = visual.agent.type === "contractor" ? 110 : 140;
      const dx = visual.targetX - visual.x;
      const dy = visual.targetY - visual.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 0.1) {
        const step = Math.min(distance, speed * seconds);
        const ratio = distance === 0 ? 0 : step / distance;
        visual.x += dx * ratio;
        visual.y += dy * ratio;
      }

      const archetype = this.archetypeFor(visual.agent);
      const pose = this.poseFor(visual.agent.status, now + visual.phase);
      visual.sprite.texture = this.texture(archetype, pose);

      visual.sprite.tint =
        visual.agent.status === "error" && Math.floor((now + visual.phase) * 8) % 2 === 0
          ? 0xff7a7a
          : 0xffffff;

      let bob = 0;
      if (visual.agent.status === "working") {
        bob = Math.sin((now + visual.phase) * 12) * 2.5;
      } else if (visual.agent.status === "thinking") {
        bob = Math.sin((now + visual.phase) * 8) * 1.4;
      }

      visual.sprite.x = visual.x;
      visual.sprite.y = visual.y + bob;
      visual.sprite.zIndex = visual.sprite.y;

      if (visual.despawning && Math.hypot(visual.x - ENTRY_POINT.x, visual.y - ENTRY_POINT.y) < 6) {
        this.removeVisual(id);
      }
    }

    this.drawConnections();
  };

  private removeVisual(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) {
      return;
    }

    visual.sprite.removeFromParent();
    visual.sprite.destroy();
    this.visuals.delete(id);
  }

  private drawConnections(): void {
    if (!this.connectionLayer) {
      return;
    }

    this.connectionLayer.clear();

    const renderedPairs = new Set<string>();

    for (const visual of this.visuals.values()) {
      if (visual.despawning) {
        continue;
      }

      for (const connectionId of visual.agent.connections) {
        const target = this.visuals.get(connectionId);
        if (!target || target.despawning) {
          continue;
        }

        const pairKey = visual.agent.id < connectionId
          ? `${visual.agent.id}|${connectionId}`
          : `${connectionId}|${visual.agent.id}`;

        if (renderedPairs.has(pairKey)) {
          continue;
        }

        renderedPairs.add(pairKey);

        this.connectionLayer.moveTo(visual.x, visual.y - 20);
        this.connectionLayer.lineTo(target.x, target.y - 20);
        this.connectionLayer.stroke({
          color: 0x66d9ff,
          width: 2,
          alpha: 0.8,
        });
      }
    }
  }

  private claimContractorSlot(agentId: string): number | null {
    const usedSlots = new Set<number>();

    for (const [id, visual] of this.visuals) {
      if (id === agentId || visual.agent.type !== "contractor" || visual.slotIndex === null || visual.despawning) {
        continue;
      }

      usedSlots.add(visual.slotIndex);
    }

    for (let index = 0; index < CONTRACTOR_DESKS.length; index += 1) {
      if (!usedSlots.has(index)) {
        return index;
      }
    }

    return null;
  }

  private persistentPosition(id: string): { x: number; y: number } {
    const desk = PERSISTENT_DESKS[id] ?? { x: 2, y: 2 };
    return deskToAgentPosition(desk);
  }

  private archetypeFor(agent: AgentState): Archetype {
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

  private poseFor(status: AgentStatus, time: number): Pose {
    switch (status) {
      case "thinking":
        return Math.floor(time * 5) % 2 === 0 ? "thinking" : "idle";
      case "working":
        return Math.floor(time * 8) % 2 === 0 ? "working" : "thinking";
      case "error":
        return Math.floor(time * 6) % 2 === 0 ? "error" : "idle";
      default:
        return "idle";
    }
  }

  private texture(archetype: Archetype, pose: Pose): Texture {
    const key = `${archetype}_${pose}`;

    return this.agentTextures[key] ?? this.agentTextures.codex_idle ?? Texture.WHITE;
  }

  private tile(name: string): Texture {
    return this.tileTextures[name] ?? Texture.WHITE;
  }
}
