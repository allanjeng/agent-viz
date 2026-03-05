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
    for (let band = 0; band < 6; band += 1) {
      const alpha = 0.07 + band * 0.04;
      const y = Math.floor((heightPx / 6) * band);
      this.addRect(0, y, widthPx, Math.ceil(heightPx / 6) + 2, PALETTE.backgroundBottom, alpha);
    }

    this.drawTiledFloor();
    this.drawPerimeterWalls();

    this.drawZoneFrame(1, 1, 8, 7, PALETTE.nexusBrass);
    this.drawNexusCommandCenter(1, 1, 8, 7);

    this.drawZoneFrame(8, 1, 8, 7, PALETTE.pivotGold);
    this.drawPivotTradingStation(8, 1, 8, 7);

    this.drawZoneFrame(1, 8, 8, 8, PALETTE.aegisRed);
    this.drawAegisSecurityStation(1, 8, 8, 8);

    this.drawZoneFrame(8, 8, 8, 8, PALETTE.researcherPaper);
    this.drawResearcherLibrary(8, 8, 8, 8);

    this.drawZoneFrame(17, 2, 10, 13, PALETTE.contractor);
    this.drawContractorWorkstations(17, 2, 10, 13);

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      this.drawPersistentDesk(id, desk);
    }

    for (const desk of CONTRACTOR_DESKS) {
      this.drawContractorDesk(desk);
    }

    this.drawAmbientDecor();

    const doorY = heightPx - TILE_SIZE * 2;
    this.addRect(widthPx - 16, doorY, 16, TILE_SIZE, 0x473126, 0.9);
    this.addRect(widthPx - 14, doorY + 4, 12, TILE_SIZE - 8, 0xd5ad83, 0.42);

    this.addRect(0, 0, widthPx, 10, 0xffd8b2, 0.07);
    this.addRect(0, heightPx - 12, widthPx, 12, 0x1f120d, 0.22);
  }

  private drawTiledFloor(): void {
    for (let y = 1; y < OFFICE_HEIGHT_TILES - 1; y += 1) {
      for (let x = 1; x < OFFICE_WIDTH_TILES - 1; x += 1) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const seed = this.tileSeed(x, y, 11);

        const warmTint = ((x + y) % 4 === 0)
          ? 0xffddb8
          : ((x * y) % 3 === 0 ? 0xf7c89d : 0xf1d1ad);

        if (!this.drawFreeCategoryTile("floor", px, py, seed, 0.98, warmTint)) {
          const fallback = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
          this.addRect(px, py, TILE_SIZE, TILE_SIZE, fallback, 0.96);
        }
      }
    }
  }

  private drawPerimeterWalls(): void {
    for (let x = 0; x < OFFICE_WIDTH_TILES; x += 1) {
      const topX = x * TILE_SIZE;
      const bottomX = x * TILE_SIZE;
      this.drawFreeCategoryTile("walls", topX, 0, this.tileSeed(x, 0, 21), 0.96, 0xffd7b5);
      this.drawFreeCategoryTile(
        "walls",
        bottomX,
        (OFFICE_HEIGHT_TILES - 1) * TILE_SIZE,
        this.tileSeed(x, OFFICE_HEIGHT_TILES - 1, 22),
        0.96,
        0xffcca1,
      );
    }

    for (let y = 0; y < OFFICE_HEIGHT_TILES; y += 1) {
      const leftY = y * TILE_SIZE;
      const rightY = y * TILE_SIZE;
      this.drawFreeCategoryTile("walls", 0, leftY, this.tileSeed(0, y, 23), 0.96, 0xffd8b8);
      this.drawFreeCategoryTile(
        "walls",
        (OFFICE_WIDTH_TILES - 1) * TILE_SIZE,
        rightY,
        this.tileSeed(OFFICE_WIDTH_TILES - 1, y, 24),
        0.96,
        0xffd8b8,
      );
    }

    for (let y = 1; y < OFFICE_HEIGHT_TILES - 1; y += 1) {
      this.drawFreeCategoryTile("walls", 8 * TILE_SIZE, y * TILE_SIZE, this.tileSeed(8, y, 25), 0.5, 0xf2c59a);
      this.drawFreeCategoryTile("walls", 16 * TILE_SIZE, y * TILE_SIZE, this.tileSeed(16, y, 26), 0.42, 0xf2c59a);
    }

    for (let x = 1; x < 16; x += 1) {
      this.drawFreeCategoryTile("walls", x * TILE_SIZE, 8 * TILE_SIZE, this.tileSeed(x, 8, 27), 0.45, 0xe7bc96);
    }
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

    this.addRect(x, y, width, height, 0x2a1d15, 0.24);
    this.addRect(x, y, width, 2, accent, 0.5);
    this.addRect(x, y + height - 2, width, 2, accent, 0.4);
    this.addRect(x, y, 2, height, accent, 0.3);
    this.addRect(x + width - 2, y, 2, height, accent, 0.3);
  }

  private drawNexusCommandCenter(tileX: number, tileY: number, _widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.drawFreeNamed("lab_rug_green", x + 20, y + 14, { alpha: 0.28, tint: 0xffc79e });
    this.drawFreeNamed("tech_console_long", x + 22, y + 26, { alpha: 0.95, tint: 0xffc58f });
    this.drawFreeNamed("tech_machine_lower", x + 146, y + 118, { alpha: 0.84, tint: 0xeeb07f });
    this.drawFreeNamed("tech_chip_panel", x + 180, y + 28, { alpha: 0.9, tint: 0xffd29d });
    this.drawFreeNamed("tech_display_left", x + 34, y + 30, { alpha: 0.9, tint: 0xffe0a8 });
  }

  private drawPivotTradingStation(tileX: number, tileY: number, _widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.drawFreeNamed("lab_rug_plum", x + 18, y + 14, { alpha: 0.18, tint: 0xe0aa73 });
    this.drawFreeNamed("tech_trading_board", x + 30, y + 26, { alpha: 0.96, tint: 0xf2ca8c });
    this.drawFreeNamed("tech_chart_panel", x + 178, y + 32, { alpha: 0.92, tint: 0xf4d19b });
    this.drawFreeNamed("tech_ticker_strip", x + 20, y + 110, { alpha: 0.9, tint: 0xe9b86f });
    this.drawFreeNamed("tech_indicator_strip", x + 188, y + 112, { alpha: 0.86, tint: 0xf7dda8 });
  }

  private drawAegisSecurityStation(tileX: number, tileY: number, _widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.drawFreeNamed("lab_rug_plum", x + 14, y + 18, { alpha: 0.13, tint: 0xd39787 });
    this.drawFreeNamed("tech_server_frame", x + 24, y + 22, { alpha: 0.95, tint: 0xeead9b });
    this.drawFreeNamed("tech_server_top", x + 152, y + 24, { alpha: 0.9, tint: 0xea9f91 });
    this.drawFreeNamed("tech_gate_bottom", x + 86, y + 138, { alpha: 0.88, tint: 0xd88d81 });
    this.drawFreeNamed("lab_security_door", x + 186, y + 116, { alpha: 0.92, tint: 0xf6c0b1 });
  }

  private drawResearcherLibrary(tileX: number, tileY: number, _widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.drawFreeNamed("lab_rug_green", x + 18, y + 18, { alpha: 0.16, tint: 0xd8b790 });
    this.drawFreeNamed("lab_archive_wide_a", x + 12, y + 18, { alpha: 0.96, tint: 0xf3d8b2 });
    this.drawFreeNamed("lab_archive_wide_b", x + 12, y + 106, { alpha: 0.92, tint: 0xefcda5 });
    this.drawFreeNamed("lab_study_lamp", x + 132, y + 42, { alpha: 0.94, tint: 0xffe3b0 });
    this.drawFreeNamed("tech_terminal_small", x + 164, y + 60, { alpha: 0.86, tint: 0xe7c5a8 });
    this.drawFreeNamed("lab_archive_left", x + 168, y + 118, { alpha: 0.85, tint: 0xf3d7b1 });
  }

  private drawContractorWorkstations(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    for (let row = 0; row < 3; row += 1) {
      const rowY = y + 30 + row * 122;
      this.drawFreeNamed("tech_hotdesk_strip", x + 22, rowY, { alpha: 0.92, tint: 0xf0bf95 });
      this.drawFreeNamed("tech_hotdesk_strip", x + 150, rowY, { alpha: 0.9, tint: 0xeeb989 });
      this.drawFreeNamed("lab_partition", x + 8, rowY + 30, { alpha: 0.8, tint: 0xf2cfab });
      this.drawFreeNamed("lab_partition_low", x + 146, rowY + 30, { alpha: 0.8, tint: 0xf2cfab });
    }

    this.drawFreeNamed("tech_floor_bench", x + width - 146, y + height - 72, { alpha: 0.86, tint: 0xe8b58c });
    this.drawFreeNamed("lab_terminal_panel", x + width - 58, y + 36, { alpha: 0.88, tint: 0xf5d3af });
  }

  private drawPersistentDesk(id: string, tile: TilePoint): void {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;

    if (id === "nexus") {
      if (this.drawFreeNamed("tech_console_left", x - 14, y - 18, { tint: 0xffcc98, alpha: 0.95 })) {
        this.drawFreeNamed("tech_display_mid", x + 34, y - 26, { tint: 0xffd6a5, alpha: 0.9 });
        return;
      }
    }

    if (id === "pivot") {
      if (this.drawFreeNamed("tech_trading_board", x - 20, y - 16, { tint: 0xf1c384, alpha: 0.95 })) {
        this.drawFreeNamed("tech_ticker_strip", x - 20, y + 12, { tint: 0xe8b46f, alpha: 0.9 });
        return;
      }
    }

    if (id === "aegis") {
      if (this.drawFreeNamed("tech_server_top", x - 14, y - 20, { tint: 0xe8a195, alpha: 0.94 })) {
        this.drawFreeNamed("tech_gate_left", x + 54, y - 20, { tint: 0xdd8f83, alpha: 0.88 });
        return;
      }
    }

    if (id === "researcher") {
      if (this.drawFreeNamed("lab_archive_right", x - 16, y - 24, { tint: 0xf1d2ac, alpha: 0.95 })) {
        this.drawFreeNamed("lab_study_lamp", x + 26, y - 26, { tint: 0xffdfaf, alpha: 0.92 });
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

    this.addRect(x - 2, y + 12, 32, 4, 0x140d09, 0.5);
    this.addRect(x, y, 28, 14, deskColor);
    this.addRect(x, y, 28, 3, accentColor, 0.9);
    this.addRect(x + 2, y + 14, 4, 7, 0x2b1c15);
    this.addRect(x + 22, y + 14, 4, 7, 0x2b1c15);
    this.addRect(x + 15, y - 8, 11, 7, 0x2d1f18);
    this.addRect(x + 16, y - 7, 9, 5, accentColor, 0.38);
    this.addRect(x + 4, y + 5, 8, 4, PALETTE.border, 0.62);
  }

  private drawAmbientDecor(): void {
    this.drawFreeNamed("lab_hanging_lamp", 6 * TILE_SIZE, 2, { alpha: 0.86, tint: 0xffe0b0 });
    this.drawFreeNamed("lab_hanging_lamp", 13 * TILE_SIZE, 2, { alpha: 0.8, tint: 0xffd6a5 });
    this.drawFreeNamed("lab_bike_decor", 2 * TILE_SIZE, 9 * TILE_SIZE + 6, { alpha: 0.75, tint: 0xe8ba92 });
    this.drawFreeNamed("tech_caution_left", 17 * TILE_SIZE + 12, 4 * TILE_SIZE, { alpha: 0.35, tint: 0xd79a68 });
    this.drawFreeNamed("tech_caution_right", 26 * TILE_SIZE - 20, 4 * TILE_SIZE, { alpha: 0.35, tint: 0xd79a68 });

    const randomDecor: Array<{ category: FreeFurnitureCategory; x: number; y: number; salt: number; tint: number }> = [
      { category: "decor", x: 3, y: 13, salt: 31, tint: 0xdca87b },
      { category: "decor", x: 14, y: 13, salt: 32, tint: 0xdca87b },
      { category: "lamps", x: 11, y: 9, salt: 33, tint: 0xffdcac },
      { category: "shelves", x: 9, y: 10, salt: 34, tint: 0xf0cfa8 },
      { category: "hotdesk", x: 21, y: 14, salt: 35, tint: 0xf0be92 },
    ];

    for (const item of randomDecor) {
      this.drawFreeCategoryTile(
        item.category,
        item.x * TILE_SIZE,
        item.y * TILE_SIZE,
        this.tileSeed(item.x, item.y, item.salt),
        0.78,
        item.tint,
      );
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
