import {
  Application,
  Assets,
  Container,
  Sprite,
  Text,
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

const PERSISTENT_LABELS: Record<string, string> = {
  nexus: "Nexus",
  pivot: "Pivot",
  aegis: "Aegis",
  researcher: "Researcher",
};

type WorkstationProfile = {
  zoneTile: string;
  deskTile: string;
  chairTile: string;
  props: Array<{ x: number; y: number; tile: string }>;
};

const WORKSTATIONS: Record<string, WorkstationProfile> = {
  nexus: {
    zoneTile: "zone_nexus",
    deskTile: "desk_nexus",
    chairTile: "chair_nexus",
    props: [
      { x: 2, y: 3, tile: "prop_monitor_stack" },
      { x: 7, y: 3, tile: "prop_server_rack" },
    ],
  },
  pivot: {
    zoneTile: "zone_pivot",
    deskTile: "desk_pivot",
    chairTile: "chair_pivot",
    props: [
      { x: 12, y: 3, tile: "prop_chart_board" },
      { x: 14, y: 4, tile: "prop_temp_terminal" },
    ],
  },
  aegis: {
    zoneTile: "zone_aegis",
    deskTile: "desk_aegis",
    chairTile: "chair_aegis",
    props: [
      { x: 2, y: 9, tile: "prop_shield_node" },
      { x: 7, y: 10, tile: "prop_server_rack" },
    ],
  },
  researcher: {
    zoneTile: "zone_researcher",
    deskTile: "desk_researcher",
    chairTile: "chair_researcher",
    props: [
      { x: 12, y: 9, tile: "prop_book_stack" },
      { x: 14, y: 10, tile: "prop_book_stack" },
    ],
  },
};

const CONTRACTOR_PROPS: Array<{ x: number; y: number; tile: string }> = [
  { x: 18, y: 3, tile: "prop_temp_terminal" },
  { x: 23, y: 3, tile: "prop_temp_terminal" },
  { x: 18, y: 6, tile: "prop_temp_terminal" },
  { x: 23, y: 6, tile: "prop_temp_terminal" },
  { x: 18, y: 9, tile: "prop_temp_terminal" },
  { x: 23, y: 9, tile: "prop_temp_terminal" },
  { x: 25, y: 12, tile: "prop_server_rack" },
];

type AgentVisual = {
  agent: AgentState;
  container: Container;
  sprite: Sprite;
  label: Text;
  labelShadow: Text;
  slotIndex: number | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
  targetAlpha: number;
  despawning: boolean;
  phase: number;
};

export class OfficeScene {
  private readonly host: HTMLElement;

  private app: Application | null = null;

  private backgroundLayer: Container | null = null;

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
      background: 0x0d1117,
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
    const agentLayer = new Container();
    agentLayer.sortableChildren = true;

    app.stage.addChild(backgroundLayer);
    app.stage.addChild(agentLayer);

    this.app = app;
    this.backgroundLayer = backgroundLayer;
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
        let floorTile = (tileX + tileY) % 2 === 0 ? "floor_dark" : "floor_alt";

        if (tileY === 8 && tileX > 1 && tileX < OFFICE_WIDTH_TILES - 1) {
          floorTile = "floor_grid";
        }

        if (tileX >= 17 && tileY >= 2 && tileY <= 14 && tileX % 2 === 0) {
          floorTile = "floor_grid";
        }

        this.placeTile(floorTile, tileX, tileY);
      }
    }

    for (let tileX = 0; tileX < OFFICE_WIDTH_TILES; tileX += 1) {
      this.placeTile(tileX % 3 === 0 ? "wall_neon" : "wall_dark", tileX, 0);
      this.placeTile("wall_dark", tileX, OFFICE_HEIGHT_TILES - 1);
    }

    for (let tileY = 1; tileY < OFFICE_HEIGHT_TILES - 1; tileY += 1) {
      this.placeTile("wall_dark", 0, tileY);
      this.placeTile("wall_dark", OFFICE_WIDTH_TILES - 1, tileY);
    }

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      const station = WORKSTATIONS[id];
      if (!station) {
        continue;
      }

      this.paintZone(desk.x - 1, desk.y - 1, 4, 4, station.zoneTile);
      this.placeTile(station.deskTile, desk.x, desk.y);
      this.placeTile(station.chairTile, desk.x, desk.y + 1);

      for (const prop of station.props) {
        this.placeTile(prop.tile, prop.x, prop.y);
      }
    }

    this.paintZone(17, 3, 10, 10, "zone_contract");

    for (const desk of CONTRACTOR_DESKS) {
      this.placeTile("desk_contract", desk.x, desk.y);
      this.placeTile("chair_contract", desk.x, desk.y + 1);
    }

    for (const prop of CONTRACTOR_PROPS) {
      this.placeTile(prop.tile, prop.x, prop.y);
    }

    this.placeTile("prop_server_rack", 25, 2);
    this.placeTile("prop_chart_board", 20, 13);
    this.placeTile("prop_monitor_stack", 9, 1);

    this.placeTile("door", OFFICE_WIDTH_TILES - 1, OFFICE_HEIGHT_TILES - 2);
  }

  private placeTile(tileName: string, tileX: number, tileY: number): void {
    if (!this.backgroundLayer) {
      return;
    }

    const sprite = new Sprite(this.tile(tileName));
    sprite.x = tileX * TILE_SIZE;
    sprite.y = tileY * TILE_SIZE;
    this.backgroundLayer.addChild(sprite);
  }

  private paintZone(startX: number, startY: number, width: number, height: number, tileName: string): void {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tileX = startX + x;
        const tileY = startY + y;

        if (
          tileX <= 0 ||
          tileY <= 0 ||
          tileX >= OFFICE_WIDTH_TILES - 1 ||
          tileY >= OFFICE_HEIGHT_TILES - 1
        ) {
          continue;
        }

        this.placeTile(tileName, tileX, tileY);
      }
    }
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
        this.agentLayer.addChild(visual.container);
      }

      visual.agent = agent;
      visual.despawning = false;
      visual.targetAlpha = 1;
      const labelText = this.labelFor(agent);

      if (visual.label.text !== labelText) {
        visual.label.text = labelText;
        visual.labelShadow.text = labelText;
      }

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
      visual.targetAlpha = 0;
    }
  }

  private createVisual(agent: AgentState): AgentVisual {
    const archetype = this.archetypeFor(agent);
    const container = new Container();
    const sprite = new Sprite(this.texture(archetype, "idle"));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(1);

    const labelShadow = new Text({
      text: this.labelFor(agent),
      style: {
        fill: 0x05070b,
        fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
        fontSize: 8,
        fontWeight: "700",
      },
      resolution: 2,
    });
    labelShadow.anchor.set(0.5, 0);
    labelShadow.x = 1;
    labelShadow.y = 5;

    const label = new Text({
      text: this.labelFor(agent),
      style: {
        fill: 0xc9d1d9,
        fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
        fontSize: 8,
        fontWeight: "700",
      },
      resolution: 2,
    });
    label.anchor.set(0.5, 0);
    label.y = 4;

    container.addChild(sprite, labelShadow, label);

    const start = agent.type === "contractor"
      ? { x: ENTRY_POINT.x, y: ENTRY_POINT.y }
      : this.persistentPosition(agent.id);

    container.x = start.x;
    container.y = start.y;
    const initialAlpha = agent.type === "contractor" ? 0 : 1;
    container.alpha = initialAlpha;

    return {
      agent,
      container,
      sprite,
      label,
      labelShadow,
      slotIndex: null,
      x: start.x,
      y: start.y,
      targetX: start.x,
      targetY: start.y,
      alpha: initialAlpha,
      targetAlpha: 1,
      despawning: false,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private readonly tick = (ticker: Ticker): void => {
    if (!this.agentLayer) {
      return;
    }

    const seconds = ticker.deltaMS / 1000;
    const now = performance.now() / 1000;

    for (const [id, visual] of this.visuals) {
      const speed = visual.agent.type === "contractor" ? 110 : 140;
      const dx = visual.targetX - visual.x;
      const dy = visual.targetY - visual.y;
      const distance = Math.hypot(dx, dy);
      const moving = distance > 1;

      if (distance > 0.1) {
        const step = Math.min(distance, speed * seconds);
        const ratio = distance === 0 ? 0 : step / distance;
        visual.x += dx * ratio;
        visual.y += dy * ratio;
      }

      const archetype = this.archetypeFor(visual.agent);
      const pose = moving && visual.agent.type === "contractor"
        ? (Math.floor((now + visual.phase) * 10) % 2 === 0 ? "working" : "thinking")
        : this.poseFor(visual.agent.status, now + visual.phase);
      visual.sprite.texture = this.texture(archetype, pose);

      visual.sprite.tint =
        visual.agent.status === "error" && Math.floor((now + visual.phase) * 8) % 2 === 0
          ? 0xff8b8b
          : 0xffffff;

      let bob = 0;
      if (moving && visual.agent.type === "contractor") {
        bob = Math.sin((now + visual.phase) * 16) * 1.6;
      } else if (visual.agent.status === "working") {
        bob = Math.sin((now + visual.phase) * 12) * 2.2;
      } else if (visual.agent.status === "thinking") {
        bob = Math.sin((now + visual.phase) * 8) * 1.2;
      }

      if (visual.alpha !== visual.targetAlpha) {
        const fadeSpeed = visual.despawning ? 3.4 : 4.2;
        const alphaStep = fadeSpeed * seconds;
        if (visual.alpha < visual.targetAlpha) {
          visual.alpha = Math.min(visual.targetAlpha, visual.alpha + alphaStep);
        } else {
          visual.alpha = Math.max(visual.targetAlpha, visual.alpha - alphaStep);
        }
      }

      visual.container.x = visual.x;
      visual.container.y = visual.y + bob;
      visual.container.zIndex = visual.container.y;
      visual.container.alpha = visual.alpha;

      if (
        visual.despawning &&
        Math.hypot(visual.x - ENTRY_POINT.x, visual.y - ENTRY_POINT.y) < 6 &&
        visual.alpha <= 0.05
      ) {
        this.removeVisual(id);
      }
    }
  };

  private removeVisual(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) {
      return;
    }

    visual.container.removeFromParent();
    visual.container.destroy({ children: true });
    this.visuals.delete(id);
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

  private labelFor(agent: AgentState): string {
    if (agent.type === "persistent") {
      return PERSISTENT_LABELS[agent.id] ?? agent.name;
    }

    return agent.name;
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
