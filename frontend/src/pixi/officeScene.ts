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
import { CONTRACTOR_THEME, OFFICE_PALETTE, PERSISTENT_THEMES } from "./theme";
import {
  FreeFurnitureAtlas,
  FreeFurnitureCategory,
  loadFreeFurnitureAtlas,
} from "./freeFurniture";

type Archetype = "nexus" | "pivot" | "aegis" | "researcher" | "codex" | "claude" | "gemini";
type CharacterDirection = "down" | "up" | "right" | "left";
type CharacterRow = "down" | "up" | "right";

type CharacterFrames = Record<CharacterRow, Texture[]>;

type DrawOptions = {
  alpha?: number;
  tint?: number;
};

const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 32;
const CHARACTER_SCALE = 3;

const PALETTE = OFFICE_PALETTE;

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

  private freeFurniture: FreeFurnitureAtlas | null = null;

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

    this.freeFurniture = await loadFreeFurnitureAtlas();

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

    this.addRect(0, 0, widthPx, heightPx, PALETTE.backgroundTop, 1);
    this.addRect(0, 0, widthPx, heightPx, PALETTE.backgroundBottom, 0.16);
    this.addRect(0, 0, widthPx, Math.round(heightPx * 0.32), PALETTE.text, 0.045);

    this.drawWarmFloor();
    this.drawPerimeterWalls();

    this.drawZoneFrame(2, 2, 9, 8, PALETTE.nexus);
    this.drawNexusCommandCenter(2, 2, 9, 8);

    this.drawZoneFrame(11, 2, 9, 8, PALETTE.pivot);
    this.drawPivotTradingStation(11, 2, 9, 8);

    this.drawZoneFrame(2, 10, 9, 8, PALETTE.aegis);
    this.drawAegisSecurityStation(2, 10, 9, 8);

    this.drawZoneFrame(11, 10, 9, 8, PALETTE.researcher);
    this.drawResearcherLibrary(11, 10, 9, 8);

    this.drawZoneFrame(21, 2, 10, 16, PALETTE.contractor);
    this.drawContractorWorkstations(21, 2, 10, 16);

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      this.drawPersistentDesk(id, desk);
    }

    for (const desk of CONTRACTOR_DESKS) {
      this.drawContractorDesk(desk);
    }

    this.drawAmbientDecor();

    const doorY = heightPx - TILE_SIZE * 2;
    this.addRect(widthPx - 18, doorY, 18, TILE_SIZE, PALETTE.wallTrim, 0.9);
    this.addRect(widthPx - 14, doorY + 6, 12, TILE_SIZE - 12, PALETTE.floorA, 0.5);

    this.addRect(0, 0, widthPx, 8, PALETTE.text, 0.05);
  }

  private drawWarmFloor(): void {
    const floorX = TILE_SIZE;
    const floorY = TILE_SIZE;
    const floorWidth = (OFFICE_WIDTH_TILES - 2) * TILE_SIZE;
    const floorHeight = (OFFICE_HEIGHT_TILES - 2) * TILE_SIZE;

    this.addRect(floorX, floorY, floorWidth, floorHeight, PALETTE.floorA, 1);
    this.addRect(floorX, floorY, floorWidth, floorHeight, PALETTE.floorB, 0.16);

    const plankSpacing = Math.max(18, Math.round(TILE_SIZE * 1.4));
    for (let y = floorY + plankSpacing; y < floorY + floorHeight; y += plankSpacing) {
      this.addRect(floorX, y, floorWidth, 1, PALETTE.floorLine, 0.2);
    }

    const seamSpacing = TILE_SIZE * 6;
    for (let x = floorX + seamSpacing; x < floorX + floorWidth; x += seamSpacing) {
      this.addRect(x, floorY, 1, floorHeight, PALETTE.floorLine, 0.08);
    }
  }

  private drawPerimeterWalls(): void {
    const wallColor = PALETTE.wall;
    const trimColor = PALETTE.wallTrim;
    const fullWidth = OFFICE_WIDTH_TILES * TILE_SIZE;
    const fullHeight = OFFICE_HEIGHT_TILES * TILE_SIZE;
    const innerHeight = (OFFICE_HEIGHT_TILES - 2) * TILE_SIZE;
    const innerWidth = (OFFICE_WIDTH_TILES - 2) * TILE_SIZE;

    this.addRect(0, 0, fullWidth, TILE_SIZE, wallColor, 0.98);
    this.addRect(0, fullHeight - TILE_SIZE, fullWidth, TILE_SIZE, wallColor, 0.98);
    this.addRect(0, TILE_SIZE, TILE_SIZE, innerHeight, wallColor, 0.98);
    this.addRect(fullWidth - TILE_SIZE, TILE_SIZE, TILE_SIZE, innerHeight, wallColor, 0.98);

    this.addRect(TILE_SIZE, TILE_SIZE + 2, innerWidth, 2, trimColor, 0.3);
    this.addRect(TILE_SIZE, fullHeight - TILE_SIZE - 4, innerWidth, 2, trimColor, 0.26);
    this.addRect(TILE_SIZE + 2, TILE_SIZE, 2, innerHeight, trimColor, 0.22);
    this.addRect(fullWidth - TILE_SIZE - 4, TILE_SIZE, 2, innerHeight, trimColor, 0.22);

    this.addRect(11 * TILE_SIZE - 1, TILE_SIZE, 2, innerHeight, trimColor, 0.26);
    this.addRect(20 * TILE_SIZE - 1, TILE_SIZE, 2, innerHeight, trimColor, 0.26);
    this.addRect(TILE_SIZE, 10 * TILE_SIZE - 1, 19 * TILE_SIZE, 2, trimColor, 0.24);
  }

  private drawZoneFrame(
    tileX: number,
    tileY: number,
    widthTiles: number,
    heightTiles: number,
    accent: number,
  ): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.addRect(x, y, width, height, PALETTE.panelA, 0.14);
    this.addRect(x + 1, y + 1, width - 2, height - 2, PALETTE.panelB, 0.06);
    this.addRect(x, y, width, 1, accent, 0.64);
    this.addRect(x, y + height - 1, width, 1, accent, 0.46);
    this.addRect(x, y, 1, height, accent, 0.44);
    this.addRect(x + width - 1, y, 1, height, accent, 0.44);
  }

  private drawNexusCommandCenter(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.drawFreeNamed("tech_console_long", x + 26, y + height - 72, { alpha: 0.9, tint: 0xf6ad55 });
    this.drawFreeNamed("tech_display_left", x + 24, y + 18, { alpha: 0.9, tint: 0xf8d0a2 });
    this.drawFreeNamed("tech_chip_panel", x + width - 78, y + 20, { alpha: 0.88, tint: 0xf5bc75 });
  }

  private drawPivotTradingStation(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.drawFreeNamed("tech_trading_board", x + 24, y + height - 70, { alpha: 0.9, tint: 0x9bbf5f });
    this.drawFreeNamed("tech_chart_panel", x + width - 82, y + 20, { alpha: 0.9, tint: 0xcadf95 });
    this.drawFreeNamed("tech_ticker_strip", x + 30, y + 24, { alpha: 0.84, tint: 0xbecf81 });
  }

  private drawAegisSecurityStation(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.drawFreeNamed("tech_server_frame", x + 20, y + height - 86, { alpha: 0.92, tint: 0xe57373 });
    this.drawFreeNamed("tech_gate_bottom", x + 92, y + height - 56, { alpha: 0.86, tint: 0xd76a6a });
    this.drawFreeNamed("lab_security_door", x + width - 74, y + height - 74, { alpha: 0.9, tint: 0xf0a0a0 });
  }

  private drawResearcherLibrary(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.drawFreeNamed("lab_archive_wide_a", x + 14, y + 18, { alpha: 0.94, tint: 0xe7d9ff });
    this.drawFreeNamed("lab_archive_wide_b", x + 14, y + height - 82, { alpha: 0.9, tint: 0xd8c6f8 });
    this.drawFreeNamed("lab_study_lamp", x + width - 118, y + 36, { alpha: 0.92, tint: 0xffe2b9 });
  }

  private drawContractorWorkstations(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    const rowSpacing = Math.floor((height - 140) / 3);
    for (let row = 0; row < 3; row += 1) {
      const rowY = y + 36 + row * rowSpacing;
      this.drawFreeNamed("tech_hotdesk_strip", x + 28, rowY, { alpha: 0.84, tint: 0xe5b88e });
    }
  }

  private drawPersistentDesk(id: string, tile: TilePoint): void {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;

    if (id === "nexus") {
      if (this.drawFreeNamed("tech_console_left", x - 14, y - 18, { tint: 0xffca93, alpha: 0.94 })) {
        return;
      }
    }

    if (id === "pivot") {
      if (this.drawFreeNamed("tech_trading_board", x - 20, y - 16, { tint: 0xb3c77a, alpha: 0.93 })) {
        return;
      }
    }

    if (id === "aegis") {
      if (this.drawFreeNamed("tech_server_top", x - 14, y - 20, { tint: 0xea8a8a, alpha: 0.93 })) {
        return;
      }
    }

    if (id === "researcher") {
      if (this.drawFreeNamed("lab_archive_right", x - 16, y - 24, { tint: 0xe1d0ff, alpha: 0.94 })) {
        return;
      }
    }

    const theme = PERSISTENT_THEMES[id] ?? PERSISTENT_THEMES.nexus;
    this.drawFallbackDesk(tile, theme.desk, theme.accent);
  }

  private drawContractorDesk(tile: TilePoint): void {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;

    if (this.drawFreeNamed("tech_vent_desk", x - 20, y - 4, { tint: 0xefbb8f, alpha: 0.92 })) {
      this.drawFreeCategoryTile("monitors", x + 12, y - 18, this.tileSeed(tile.x, tile.y, 91), 0.9, 0xf7d5a9);
      return;
    }

    this.drawFallbackDesk(tile, CONTRACTOR_THEME.desk, CONTRACTOR_THEME.accent);
  }

  private drawFallbackDesk(tile: TilePoint, deskColor: number, accentColor: number): void {
    const x = tile.x * TILE_SIZE + 2;
    const y = tile.y * TILE_SIZE + 8;

    this.addRect(x - 2, y + 12, 32, 4, 0x6f523f, 0.28);
    this.addRect(x, y, 28, 14, deskColor);
    this.addRect(x, y, 28, 3, accentColor, 0.9);
    this.addRect(x + 2, y + 14, 4, 7, 0x8c6b55);
    this.addRect(x + 22, y + 14, 4, 7, 0x8c6b55);
    this.addRect(x + 15, y - 8, 11, 7, 0x7b6050);
    this.addRect(x + 16, y - 7, 9, 5, accentColor, 0.4);
    this.addRect(x + 4, y + 5, 8, 4, PALETTE.wallTrim, 0.5);
  }

  private drawAmbientDecor(): void {
    this.drawFreeNamed("lab_hanging_lamp", 6 * TILE_SIZE, 2, { alpha: 0.76, tint: 0xffddb0 });
    this.drawFreeNamed("lab_hanging_lamp", 15 * TILE_SIZE, 2, { alpha: 0.76, tint: 0xffddb0 });
    this.drawFreeNamed("lab_hanging_lamp", 24 * TILE_SIZE, 2, { alpha: 0.72, tint: 0xffd39c });
    this.drawFreeNamed("lab_hanging_lamp", 30 * TILE_SIZE, 2, { alpha: 0.68, tint: 0xffd39c });
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

  private drawFreeNamed(name: string, x: number, y: number, options: DrawOptions = {}): boolean {
    if (!this.freeFurniture || !this.backgroundLayer) {
      return false;
    }

    const texture = this.freeFurniture.named[name];
    if (!texture) {
      return false;
    }

    const sprite = new Sprite(texture);
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.alpha = options.alpha ?? 1;
    sprite.tint = options.tint ?? 0xffffff;
    this.backgroundLayer.addChild(sprite);
    return true;
  }

  private drawFreeCategoryTile(
    category: FreeFurnitureCategory,
    x: number,
    y: number,
    seed: number,
    alpha = 1,
    tint = 0xffffff,
  ): boolean {
    if (!this.freeFurniture || !this.backgroundLayer) {
      return false;
    }

    const textures = this.freeFurniture.categories[category];
    if (!textures || textures.length === 0) {
      return false;
    }

    const index = Math.abs(seed) % textures.length;
    const sprite = new Sprite(textures[index]);
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.alpha = alpha;
    sprite.tint = tint;
    this.backgroundLayer.addChild(sprite);
    return true;
  }

  private tileSeed(x: number, y: number, salt: number): number {
    return ((x + 17) * 73856093) ^ ((y + 29) * 19349663) ^ (salt * 83492791);
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
