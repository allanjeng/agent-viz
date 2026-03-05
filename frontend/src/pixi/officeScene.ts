import {
  Application,
  Assets,
  Container,
  Rectangle,
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
  TilePoint,
} from "./layout";
import { AgentState, AgentStatus } from "../types";

type Archetype = "nexus" | "pivot" | "aegis" | "researcher" | "codex" | "claude" | "gemini";
type CharacterDirection = "down" | "up" | "right" | "left";
type CharacterRow = "down" | "up" | "right";

type CharacterFrames = Record<CharacterRow, Texture[]>;

const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 32;
const CHARACTER_SCALE = 3;
const FLOOR_TILE_SIZE = 16;

const PERSISTENT_LABELS: Record<string, string> = {
  nexus: "Nexus",
  pivot: "Pivot",
  aegis: "Aegis",
  researcher: "Researcher",
};

const CHARACTER_SHEET_PATHS: Record<Archetype, string> = {
  nexus: "/assets/characters/char_0.png",
  pivot: "/assets/characters/char_1.png",
  aegis: "/assets/characters/char_2.png",
  researcher: "/assets/characters/char_3.png",
  codex: "/assets/characters/char_4.png",
  claude: "/assets/characters/char_5.png",
  gemini: "/assets/characters/char_5.png",
};

const PERSISTENT_THEMES: Record<string, { zone: number; desk: number; accent: number; chair: number }> = {
  nexus: {
    zone: 0x1a2734,
    desk: 0x2c3f52,
    accent: 0x69b2ff,
    chair: 0x2a3c50,
  },
  pivot: {
    zone: 0x2a2438,
    desk: 0x4a3a5f,
    accent: 0xd5a3ff,
    chair: 0x413357,
  },
  aegis: {
    zone: 0x213033,
    desk: 0x35545b,
    accent: 0x77d8c0,
    chair: 0x2d4a51,
  },
  researcher: {
    zone: 0x2b2b36,
    desk: 0x4e4b5f,
    accent: 0x9fb0ff,
    chair: 0x444059,
  },
};

const CONTRACTOR_THEME = {
  zone: 0x182733,
  desk: 0x34495d,
  accent: 0x7ec7ff,
  chair: 0x2d4052,
};

type AgentVisual = {
  agent: AgentState;
  container: Container;
  sprite: Sprite;
  errorOverlay: Sprite;
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

  private characterFrames = new Map<Archetype, CharacterFrames>();

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
    this.characterFrames.clear();
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

    await Promise.all(
      (Object.entries(CHARACTER_SHEET_PATHS) as Array<[Archetype, string]>).map(([archetype, path]) =>
        this.loadCharacterSheet(archetype, path),
      ),
    );

    if (this.destroyed) {
      return;
    }

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

    const widthPx = OFFICE_WIDTH_TILES * TILE_SIZE;
    const heightPx = OFFICE_HEIGHT_TILES * TILE_SIZE;
    const floorCols = Math.ceil(widthPx / FLOOR_TILE_SIZE);
    const floorRows = Math.ceil(heightPx / FLOOR_TILE_SIZE);

    this.addRect(0, 0, widthPx, heightPx, 0x0b1118);

    for (let y = 0; y < floorRows; y += 1) {
      for (let x = 0; x < floorCols; x += 1) {
        let floorColor = (x + y) % 2 === 0 ? 0x111821 : 0x0f151d;

        if ((x + y * 3) % 11 === 0) {
          floorColor = 0x13202a;
        }

        if (y >= 15 && y <= 18) {
          floorColor = x % 2 === 0 ? 0x16212c : 0x141d27;
        }

        if (x >= 34 && x <= 54 && y >= 4 && y <= 30 && x % 2 === 0) {
          floorColor = 0x16242e;
        }

        const px = x * FLOOR_TILE_SIZE;
        const py = y * FLOOR_TILE_SIZE;

        this.addRect(px, py, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE, floorColor);

        if ((x + y) % 4 === 0) {
          this.addRect(px, py, FLOOR_TILE_SIZE, 1, 0x1d2b37, 0.28);
        }
      }
    }

    this.addRect(0, 0, widthPx, 16, 0x202d3a);
    this.addRect(0, heightPx - 16, widthPx, 16, 0x1b2734);
    this.addRect(0, 0, 16, heightPx, 0x1b2734);
    this.addRect(widthPx - 16, 0, 16, heightPx, 0x1b2734);
    this.addRect(16, 6, widthPx - 32, 2, 0x55a8ff, 0.45);

    const doorY = heightPx - TILE_SIZE * 2;
    this.addRect(widthPx - 16, doorY, 16, TILE_SIZE, 0x314659);
    this.addRect(widthPx - 14, doorY + 4, 12, TILE_SIZE - 8, 0x7eb7ff, 0.28);

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      const theme = PERSISTENT_THEMES[id] ?? PERSISTENT_THEMES.nexus;
      this.addRect(desk.x * TILE_SIZE - 20, desk.y * TILE_SIZE - 14, 72, 62, theme.zone, 0.42);
      this.drawDesk(desk, theme.desk, theme.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, theme.chair);
    }

    this.addRect(17 * TILE_SIZE, 3 * TILE_SIZE, 10 * TILE_SIZE, 10 * TILE_SIZE, CONTRACTOR_THEME.zone, 0.42);

    for (const desk of CONTRACTOR_DESKS) {
      this.drawDesk(desk, CONTRACTOR_THEME.desk, CONTRACTOR_THEME.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, CONTRACTOR_THEME.chair);
    }

    this.drawServerRack(25, 2);
    this.drawServerRack(25, 12);
    this.drawStatusBoard(20, 13, 0x58a6ff);
    this.drawStatusBoard(9, 1, 0x8fbcff);
  }

  private addRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha = 1,
  ): Sprite {
    const sprite = new Sprite(Texture.WHITE);
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.width = Math.max(0, Math.round(width));
    sprite.height = Math.max(0, Math.round(height));
    sprite.tint = color;
    sprite.alpha = alpha;
    this.backgroundLayer?.addChild(sprite);

    return sprite;
  }

  private drawDesk(tile: TilePoint, deskColor: number, accentColor: number): void {
    const x = tile.x * TILE_SIZE + 2;
    const y = tile.y * TILE_SIZE + 8;

    this.addRect(x - 2, y + 12, 32, 4, 0x060b10, 0.45);
    this.addRect(x, y, 28, 14, deskColor);
    this.addRect(x, y, 28, 3, accentColor, 0.88);
    this.addRect(x + 2, y + 14, 4, 7, 0x0b1219);
    this.addRect(x + 22, y + 14, 4, 7, 0x0b1219);
    this.addRect(x + 15, y - 8, 11, 7, 0x2a3f52);
    this.addRect(x + 16, y - 7, 9, 5, 0x8fd0ff, 0.45);
    this.addRect(x + 4, y + 5, 8, 4, 0x1b2937);
  }

  private drawChair(tile: TilePoint, seatColor: number): void {
    const x = tile.x * TILE_SIZE + 8;
    const y = tile.y * TILE_SIZE + 10;

    this.addRect(x, y, 16, 10, seatColor);
    this.addRect(x + 2, y - 4, 12, 4, 0x334a5f);
    this.addRect(x + 7, y + 10, 2, 6, 0x111a24);
  }

  private drawServerRack(tileX: number, tileY: number): void {
    const x = tileX * TILE_SIZE + 6;
    const y = tileY * TILE_SIZE + 4;

    this.addRect(x, y, 20, 44, 0x253445);

    for (let i = 0; i < 5; i += 1) {
      this.addRect(x + 3, y + 6 + i * 7, 14, 2, 0x7cb8ff, 0.35);
    }

    this.addRect(x + 3, y + 40, 14, 2, 0x3f556b, 0.7);
  }

  private drawStatusBoard(tileX: number, tileY: number, glowColor: number): void {
    const x = tileX * TILE_SIZE + 4;
    const y = tileY * TILE_SIZE + 4;

    this.addRect(x, y, 24, 16, 0x27394a);
    this.addRect(x + 2, y + 2, 20, 12, 0x0f1721);
    this.addRect(x + 4, y + 4, 16, 2, glowColor, 0.45);
    this.addRect(x + 4, y + 8, 12, 2, 0x87b8ff, 0.3);
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
    const sprite = new Sprite(this.texture(archetype, "down", 0));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(CHARACTER_SCALE);

    const errorOverlay = new Sprite(sprite.texture);
    errorOverlay.anchor.set(0.5, 1);
    errorOverlay.scale.set(CHARACTER_SCALE);
    errorOverlay.tint = 0xff6b6b;
    errorOverlay.alpha = 0;

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

    container.addChild(sprite, errorOverlay, labelShadow, label);

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
      errorOverlay,
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
      const speed = visual.agent.type === "contractor" ? 105 : 118;
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
      const direction = this.directionFor(visual.agent.status, moving, dx, dy);
      const frame = this.frameFor(visual.agent.status, moving, now + visual.phase);
      const texture = this.texture(archetype, direction, frame);

      visual.sprite.texture = texture;
      visual.errorOverlay.texture = texture;
      this.applyDirection(visual, direction);

      visual.errorOverlay.alpha = visual.agent.status === "error"
        ? 0.3 + (Math.sin((now + visual.phase) * 8) + 1) * 0.06
        : 0;

      let bob = 0;
      if (moving) {
        bob = Math.sin((now + visual.phase) * 10) * 1.4;
      } else if (visual.agent.status === "working") {
        bob = Math.sin((now + visual.phase) * 12) * 2;
      } else if (visual.agent.status === "thinking") {
        bob = Math.sin((now + visual.phase) * 7) * 1.1;
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

  private directionFor(status: AgentStatus, moving: boolean, dx: number, dy: number): CharacterDirection {
    if (status === "error" || !moving) {
      return "down";
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "right" : "left";
    }

    return dy >= 0 ? "down" : "up";
  }

  private frameFor(status: AgentStatus, moving: boolean, time: number): number {
    switch (status) {
      case "thinking":
        return Math.floor(time * 2) % 2;
      case "working":
        return Math.floor(time * 8) % 3;
      case "error":
        return 0;
      default:
        return moving ? Math.floor(time * 6) % 2 : 0;
    }
  }

  private applyDirection(visual: AgentVisual, direction: CharacterDirection): void {
    const xScale = direction === "left" ? -CHARACTER_SCALE : CHARACTER_SCALE;
    visual.sprite.scale.set(xScale, CHARACTER_SCALE);
    visual.errorOverlay.scale.set(xScale, CHARACTER_SCALE);
  }

  private texture(archetype: Archetype, direction: CharacterDirection, frame: number): Texture {
    const fallback = this.characterFrames.get("codex");
    const set = this.characterFrames.get(archetype) ?? fallback;

    if (!set) {
      return Texture.WHITE;
    }

    const row: CharacterRow = direction === "left" ? "right" : direction;
    const textures = set[row];

    if (textures.length === 0) {
      return Texture.WHITE;
    }

    const index = Math.max(0, Math.min(frame, textures.length - 1));
    return textures[index];
  }

  private async loadCharacterSheet(archetype: Archetype, path: string): Promise<void> {
    const sheet = await Assets.load({
      src: path,
      data: { scaleMode: "nearest" },
    }) as Texture;

    sheet.source.scaleMode = "nearest";

    const down: Texture[] = [];
    const up: Texture[] = [];
    const right: Texture[] = [];

    for (let frame = 0; frame < 3; frame += 1) {
      down.push(this.sliceCharacterFrame(sheet, frame, 0));
      up.push(this.sliceCharacterFrame(sheet, frame, 1));
      right.push(this.sliceCharacterFrame(sheet, frame, 2));
    }

    this.characterFrames.set(archetype, { down, up, right });
  }

  private sliceCharacterFrame(sheet: Texture, frameColumn: number, frameRow: number): Texture {
    return new Texture({
      source: sheet.source,
      frame: new Rectangle(
        frameColumn * CHARACTER_FRAME_WIDTH,
        frameRow * CHARACTER_FRAME_HEIGHT,
        CHARACTER_FRAME_WIDTH,
        CHARACTER_FRAME_HEIGHT,
      ),
    });
  }
}
