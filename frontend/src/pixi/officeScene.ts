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

const PALETTE = {
  backgroundTop: 0x060912,
  backgroundBottom: 0x0b1020,
  floorA: 0x111827,
  floorB: 0x0f172a,
  panelA: 0x111827,
  panelB: 0x0f172a,
  border: 0x2a3448,
  text: 0xe5e7eb,
  nexus: 0x22d3ee,
  pivot: 0x22c55e,
  aegis: 0xf43f5e,
  researcher: 0xa78bfa,
  contractor: 0xf59e0b,
};

const PERSISTENT_LABELS: Record<string, string> = {
  nexus: "Nexus",
  pivot: "Pivot",
  aegis: "Aegis",
  researcher: "Researcher",
};

const CHARACTER_SHEET_PATHS: Record<Archetype, string> = {
  nexus: "/assets/characters/char_0.png",
  pivot: "/assets/characters/char_4.png",
  aegis: "/assets/characters/char_1.png",
  researcher: "/assets/characters/char_3.png",
  codex: "/assets/characters/char_2.png",
  claude: "/assets/characters/char_5.png",
  gemini: "/assets/characters/char_5.png",
};

const PERSISTENT_THEMES: Record<string, { desk: number; accent: number; chair: number }> = {
  nexus: {
    desk: 0x1f2d3f,
    accent: PALETTE.nexus,
    chair: 0x1a2534,
  },
  pivot: {
    desk: 0x223328,
    accent: PALETTE.pivot,
    chair: 0x1b2a21,
  },
  aegis: {
    desk: 0x35232a,
    accent: PALETTE.aegis,
    chair: 0x291b21,
  },
  researcher: {
    desk: 0x2b2541,
    accent: PALETTE.researcher,
    chair: 0x221d33,
  },
};

const CONTRACTOR_THEME = {
  desk: 0x2f313d,
  accent: PALETTE.contractor,
  chair: 0x252934,
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
      background: PALETTE.backgroundTop,
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

    this.addRect(0, 0, widthPx, heightPx, PALETTE.backgroundTop);

    for (let band = 0; band < 8; band += 1) {
      const alpha = 0.1 + band * 0.05;
      const y = Math.floor((heightPx / 8) * band);
      this.addRect(0, y, widthPx, Math.ceil(heightPx / 8) + 2, PALETTE.backgroundBottom, alpha);
    }

    for (let y = 0; y < floorRows; y += 1) {
      for (let x = 0; x < floorCols; x += 1) {
        const floorColor = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        const px = x * FLOOR_TILE_SIZE;
        const py = y * FLOOR_TILE_SIZE;

        this.addRect(px, py, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE, floorColor, 0.93);

        if ((x + y) % 3 === 0) {
          this.addRect(px, py, FLOOR_TILE_SIZE, 1, PALETTE.border, 0.1);
        }
      }
    }

    this.addRect(0, 0, widthPx, 16, PALETTE.panelB, 0.95);
    this.addRect(0, heightPx - 16, widthPx, 16, PALETTE.panelB, 0.95);
    this.addRect(0, 0, 16, heightPx, PALETTE.panelB, 0.95);
    this.addRect(widthPx - 16, 0, 16, heightPx, PALETTE.panelB, 0.95);
    this.addRect(16, 6, widthPx - 32, 2, PALETTE.border, 0.6);

    this.drawZonePanel(1, 1, 8, 7, PALETTE.nexus);
    this.drawNexusCommandCenter(1, 1, 8, 7);

    this.drawZonePanel(8, 1, 8, 7, PALETTE.pivot);
    this.drawPivotTradingStation(8, 1, 8, 7);

    this.drawZonePanel(1, 8, 8, 8, PALETTE.aegis);
    this.drawAegisSecurityStation(1, 8, 8, 8);

    this.drawZonePanel(8, 8, 8, 8, PALETTE.researcher);
    this.drawResearcherLibrary(8, 8, 8, 8);

    this.drawZonePanel(17, 2, 10, 13, PALETTE.contractor);
    this.drawContractorWorkstations(17, 2, 10, 13);

    const doorY = heightPx - TILE_SIZE * 2;
    this.addRect(widthPx - 16, doorY, 16, TILE_SIZE, 0x1f2a3a);
    this.addRect(widthPx - 14, doorY + 4, 12, TILE_SIZE - 8, PALETTE.contractor, 0.34);

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      const theme = PERSISTENT_THEMES[id] ?? PERSISTENT_THEMES.nexus;
      this.drawDesk(desk, theme.desk, theme.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, theme.chair);
    }

    for (const desk of CONTRACTOR_DESKS) {
      this.drawDesk(desk, CONTRACTOR_THEME.desk, CONTRACTOR_THEME.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, CONTRACTOR_THEME.chair);
    }
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

  private drawZonePanel(tileX: number, tileY: number, widthTiles: number, heightTiles: number, accent: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.addRect(x, y, width, height, PALETTE.panelA, 0.72);
    this.addRect(x + 2, y + 2, width - 4, height - 4, PALETTE.panelB, 0.68);
    this.addRect(x, y, width, 2, PALETTE.border, 0.95);
    this.addRect(x, y + height - 2, width, 2, PALETTE.border, 0.95);
    this.addRect(x, y, 2, height, PALETTE.border, 0.95);
    this.addRect(x + width - 2, y, 2, height, PALETTE.border, 0.95);
    this.addRect(x + 6, y + 6, width - 12, 2, accent, 0.34);
    this.addRect(x + 6, y + height - 8, width - 12, 2, accent, 0.2);
  }

  private drawNexusCommandCenter(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const sx = x + 16 + col * 44;
        const sy = y + 18 + row * 30;
        this.addRect(sx, sy, 36, 20, 0x0b1320);
        this.addRect(sx + 2, sy + 2, 32, 16, PALETTE.nexus, 0.25);
        this.addRect(sx + 4, sy + 5, 28, 2, PALETTE.nexus, 0.75);
        this.addRect(sx + 4, sy + 10, 19, 2, PALETTE.nexus, 0.42);
        this.addRect(sx + 4, sy + 14, 24, 1, PALETTE.nexus, 0.3);
      }
    }

    this.addRect(x + width - 48, y + 16, 28, height - 36, 0x101b2b);
    for (let i = 0; i < 7; i += 1) {
      this.addRect(x + width - 44, y + 22 + i * 20, 20, 2, PALETTE.nexus, 0.4);
    }
  }

  private drawPivotTradingStation(tileX: number, tileY: number, widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.addRect(x + 12, y + 18, 92, 30, 0x0d1a13);
    this.addRect(x + 14, y + 20, 88, 26, PALETTE.pivot, 0.18);
    this.addRect(x + 16, y + 39, 16, 2, PALETTE.pivot, 0.55);
    this.addRect(x + 34, y + 33, 14, 2, PALETTE.pivot, 0.8);
    this.addRect(x + 50, y + 28, 14, 2, PALETTE.pivot, 0.75);
    this.addRect(x + 66, y + 31, 14, 2, PALETTE.pivot, 0.7);
    this.addRect(x + 82, y + 24, 14, 2, PALETTE.pivot, 0.78);

    this.addRect(x + 110, y + 18, 116, 30, 0x0d1a13);
    this.addRect(x + 112, y + 20, 112, 26, PALETTE.pivot, 0.16);

    for (let i = 0; i < 6; i += 1) {
      this.addRect(x + 117 + i * 18, y + 39 - i * 2, 14, 2, PALETTE.pivot, 0.72);
    }

    this.addRect(x + 12, y + 56, 214, 12, 0x112016);
    for (let i = 0; i < 14; i += 1) {
      this.addRect(x + 16 + i * 15, y + 60, 10, 2, PALETTE.pivot, i % 3 === 0 ? 0.7 : 0.35);
    }
  }

  private drawAegisSecurityStation(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.addRect(x + 18, y + 18, 38, 38, 0x23121a);
    this.addRect(x + 24, y + 24, 26, 20, PALETTE.aegis, 0.22);
    this.addRect(x + 30, y + 20, 14, 8, PALETTE.aegis, 0.28);
    this.addRect(x + 33, y + 23, 8, 7, 0x151922);
    this.addRect(x + 31, y + 31, 12, 10, PALETTE.aegis, 0.62);

    this.addRect(x + 74, y + 18, 38, 38, 0x23121a);
    this.addRect(x + 84, y + 24, 18, 8, PALETTE.aegis, 0.28);
    this.addRect(x + 80, y + 32, 26, 12, PALETTE.aegis, 0.58);
    this.addRect(x + 84, y + 34, 18, 8, 0x151922);

    this.addRect(x + width - 44, y + 20, 16, 16, PALETTE.aegis, 0.86);
    this.addRect(x + width - 48, y + 16, 24, 24, PALETTE.aegis, 0.24);
    this.addRect(x + width - 37, y + 27, 2, 2, 0xffffff, 0.8);

    this.addRect(x + 14, y + height - 24, width - 28, 10, 0x24131b);
    for (let i = 0; i < 8; i += 1) {
      this.addRect(x + 20 + i * 28, y + height - 21, 18, 3, i % 2 === 0 ? PALETTE.aegis : 0x121821, 0.8);
    }
  }

  private drawResearcherLibrary(tileX: number, tileY: number, widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;

    this.addRect(x + 10, y + 14, 32, 96, 0x1a1727);
    this.addRect(x + width - 42, y + 14, 32, 96, 0x1a1727);

    for (let shelf = 0; shelf < 5; shelf += 1) {
      const shelfY = y + 24 + shelf * 17;
      this.addRect(x + 12, shelfY, 28, 2, PALETTE.researcher, 0.35);
      this.addRect(x + width - 40, shelfY, 28, 2, PALETTE.researcher, 0.35);
      for (let book = 0; book < 4; book += 1) {
        this.addRect(x + 14 + book * 6, shelfY - 10, 4, 9, PALETTE.researcher, 0.25 + book * 0.1);
        this.addRect(x + width - 38 + book * 6, shelfY - 10, 4, 9, PALETTE.researcher, 0.2 + book * 0.1);
      }
    }

    this.addRect(x + 62, y + 22, 128, 52, 0x171425);
    this.addRect(x + 64, y + 24, 124, 48, PALETTE.researcher, 0.12);
    this.addRect(x + 72, y + 32, 36, 22, 0xd4d7e1);
    this.addRect(x + 114, y + 38, 28, 18, 0xcfd3dc);
    this.addRect(x + 150, y + 30, 30, 20, 0xdce0ea);
    this.addRect(x + 74, y + 36, 30, 2, PALETTE.researcher, 0.4);
    this.addRect(x + 116, y + 43, 24, 2, PALETTE.researcher, 0.35);
    this.addRect(x + 152, y + 35, 24, 2, PALETTE.researcher, 0.36);
  }

  private drawContractorWorkstations(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    for (let row = 0; row < 3; row += 1) {
      const rowY = y + 32 + row * 96;
      this.addRect(x + 14, rowY, width - 28, 12, 0x1a202e);
      this.addRect(x + 14, rowY, width - 28, 2, PALETTE.contractor, 0.45);

      for (let seat = 0; seat < 3; seat += 1) {
        const seatX = x + 26 + seat * 86;
        this.addRect(seatX, rowY - 18, 24, 16, 0x151d2a);
        this.addRect(seatX + 2, rowY - 16, 20, 12, PALETTE.contractor, 0.24);
        this.addRect(seatX + 4, rowY - 10, 16, 2, PALETTE.contractor, 0.56);
      }
    }

    this.addRect(x + width - 38, y + 14, 18, height - 28, 0x1d2028);
    for (let i = 0; i < 8; i += 1) {
      this.addRect(x + width - 35, y + 24 + i * 20, 12, 2, PALETTE.contractor, 0.32);
    }
  }

  private drawDesk(tile: TilePoint, deskColor: number, accentColor: number): void {
    const x = tile.x * TILE_SIZE + 2;
    const y = tile.y * TILE_SIZE + 8;

    this.addRect(x - 2, y + 12, 32, 4, 0x05070f, 0.46);
    this.addRect(x, y, 28, 14, deskColor);
    this.addRect(x, y, 28, 3, accentColor, 0.88);
    this.addRect(x + 2, y + 14, 4, 7, 0x0d1320);
    this.addRect(x + 22, y + 14, 4, 7, 0x0d1320);
    this.addRect(x + 15, y - 8, 11, 7, 0x121a28);
    this.addRect(x + 16, y - 7, 9, 5, accentColor, 0.35);
    this.addRect(x + 4, y + 5, 8, 4, PALETTE.border, 0.6);
  }

  private drawChair(tile: TilePoint, seatColor: number): void {
    const x = tile.x * TILE_SIZE + 8;
    const y = tile.y * TILE_SIZE + 10;

    this.addRect(x, y, 16, 10, seatColor);
    this.addRect(x + 2, y - 4, 12, 4, 0x273142);
    this.addRect(x + 7, y + 10, 2, 6, 0x111827);
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
        fill: PALETTE.text,
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
