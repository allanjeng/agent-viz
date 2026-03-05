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
  VendorFurnitureAtlas,
  VendorFurnitureCategory,
  loadVendorFurnitureAtlas,
} from "./vendorFurniture";

type Archetype = "nexus" | "pivot" | "aegis" | "researcher" | "codex" | "claude" | "gemini";
type CharacterDirection = "down" | "up" | "right" | "left";
type CharacterRow = "down" | "up" | "right";

type CharacterFrames = Record<CharacterRow, Texture[]>;

const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 32;
const CHARACTER_SCALE = 3;
const FLOOR_TILE_SIZE = 16;

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

  private vendorFurniture: VendorFurnitureAtlas | null = null;

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

    this.vendorFurniture = await loadVendorFurnitureAtlas();

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

    for (let band = 0; band < 9; band += 1) {
      const alpha = 0.08 + band * 0.04;
      const y = Math.floor((heightPx / 9) * band);
      this.addRect(0, y, widthPx, Math.ceil(heightPx / 9) + 2, PALETTE.backgroundBottom, alpha);
    }

    for (let y = 0; y < floorRows; y += 1) {
      for (let x = 0; x < floorCols; x += 1) {
        const floorColor = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        const px = x * FLOOR_TILE_SIZE;
        const py = y * FLOOR_TILE_SIZE;

        this.addRect(px, py, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE, floorColor, 0.96);

        if ((x + y) % 3 === 0) {
          this.addRect(px, py, FLOOR_TILE_SIZE, 1, PALETTE.border, 0.12);
        }
      }
    }

    this.addRect(0, 0, widthPx, 16, PALETTE.panelA, 0.96);
    this.addRect(0, heightPx - 16, widthPx, 16, PALETTE.panelA, 0.96);
    this.addRect(0, 0, 16, heightPx, PALETTE.panelA, 0.96);
    this.addRect(widthPx - 16, 0, 16, heightPx, PALETTE.panelA, 0.96);
    this.addRect(16, 6, widthPx - 32, 2, PALETTE.border, 0.68);
    this.addRect(16, heightPx - 8, widthPx - 32, 2, PALETTE.border, 0.52);

    this.drawZonePanel(1, 1, 8, 7, PALETTE.nexus, PALETTE.nexusBrass);
    this.drawNexusCommandCenter(1, 1, 8, 7);

    this.drawZonePanel(8, 1, 8, 7, PALETTE.pivot, PALETTE.pivotGold);
    this.drawPivotTradingStation(8, 1, 8, 7);

    this.drawZonePanel(1, 8, 8, 8, PALETTE.aegis, PALETTE.aegisRed);
    this.drawAegisSecurityStation(1, 8, 8, 8);

    this.drawZonePanel(8, 8, 8, 8, PALETTE.researcher, PALETTE.researcherPaper);
    this.drawResearcherLibrary(8, 8, 8, 8);

    this.drawZonePanel(17, 2, 10, 13, PALETTE.contractor, PALETTE.border);
    this.drawContractorWorkstations(17, 2, 10, 13);

    const doorY = heightPx - TILE_SIZE * 2;
    this.addRect(widthPx - 16, doorY, 16, TILE_SIZE, 0x3b261d);
    this.addRect(widthPx - 14, doorY + 4, 12, TILE_SIZE - 8, PALETTE.contractor, 0.36);

    for (const [id, desk] of Object.entries(PERSISTENT_DESKS)) {
      const theme = PERSISTENT_THEMES[id] ?? PERSISTENT_THEMES.nexus;
      this.drawDesk(desk, theme.desk, theme.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, theme.chair);
    }

    for (const desk of CONTRACTOR_DESKS) {
      this.drawDesk(desk, CONTRACTOR_THEME.desk, CONTRACTOR_THEME.accent);
      this.drawChair({ x: desk.x, y: desk.y + 1 }, CONTRACTOR_THEME.chair);
    }

    this.drawVendorAmbientDecor();
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

  private drawZonePanel(
    tileX: number,
    tileY: number,
    widthTiles: number,
    heightTiles: number,
    accent: number,
    accentSecondary: number,
  ): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.addRect(x, y, width, height, PALETTE.panelA, 0.78);
    this.addRect(x + 2, y + 2, width - 4, height - 4, PALETTE.panelB, 0.72);
    this.addRect(x, y, width, 2, PALETTE.border, 0.95);
    this.addRect(x, y + height - 2, width, 2, PALETTE.border, 0.95);
    this.addRect(x, y, 2, height, PALETTE.border, 0.95);
    this.addRect(x + width - 2, y, 2, height, PALETTE.border, 0.95);
    this.addRect(x + 6, y + 6, width - 12, 2, accent, 0.42);
    this.addRect(x + 6, y + height - 8, width - 12, 2, accentSecondary, 0.32);
    this.addRect(x + 6, y + 8, 2, height - 16, accentSecondary, 0.2);
    this.addRect(x + width - 8, y + 8, 2, height - 16, accent, 0.2);
  }

  private drawNexusCommandCenter(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const sx = x + 14 + col * 40;
        const sy = y + 16 + row * 28;
        this.addRect(sx, sy, 34, 20, 0x2a1a13);
        this.addRect(sx + 2, sy + 2, 30, 16, PALETTE.nexus, 0.22);
        this.addRect(sx + 4, sy + 4, 26, 2, PALETTE.nexusBrass, 0.84);
        this.addRect(sx + 4, sy + 9, 20, 2, PALETTE.nexus, 0.58);
        this.addRect(sx + 4, sy + 13, 14, 1, PALETTE.nexusBrass, 0.55);
      }
    }

    this.addRect(x + width - 52, y + 14, 34, height - 28, 0x341f16);
    for (let i = 0; i < 9; i += 1) {
      const lightColor = i % 2 === 0 ? PALETTE.nexus : PALETTE.nexusBrass;
      this.addRect(x + width - 47, y + 20 + i * 17, 24, 2, lightColor, 0.58);
    }

    this.addRect(x + 16, y + height - 26, width - 86, 10, 0x3a251c);
    for (let i = 0; i < 12; i += 1) {
      const controlColor = i % 3 === 0 ? PALETTE.nexusBrass : PALETTE.nexus;
      this.addRect(x + 20 + i * 12, y + height - 22, 7, 3, controlColor, i % 3 === 0 ? 0.88 : 0.58);
    }
  }

  private drawPivotTradingStation(tileX: number, tileY: number, _widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    this.addRect(x + 12, y + 16, 96, 34, 0x312418);
    this.addRect(x + 14, y + 18, 92, 30, PALETTE.pivot, 0.16);
    for (let i = 0; i < 5; i += 1) {
      const barHeight = 4 + i * 4;
      const barColor = i % 2 === 0 ? PALETTE.pivot : PALETTE.pivotGold;
      this.addRect(x + 20 + i * 16, y + 44 - barHeight, 10, barHeight, barColor, 0.74);
    }

    this.addRect(x + 112, y + 16, 114, 34, 0x312418);
    this.addRect(x + 114, y + 18, 110, 30, PALETTE.pivotGold, 0.16);
    for (let i = 0; i < 6; i += 1) {
      const candleColor = i % 2 === 0 ? PALETTE.pivotGold : PALETTE.pivot;
      this.addRect(x + 120 + i * 16, y + 24 + (i % 3), 8, 16 - (i % 2) * 5, candleColor, 0.84);
      this.addRect(x + 123 + i * 16, y + 21, 2, 22, candleColor, 0.65);
    }

    this.addRect(x + 12, y + 56, 214, 12, 0x3a2a1d);
    for (let i = 0; i < 14; i += 1) {
      const tickerColor = i % 3 === 0 ? PALETTE.pivotGold : PALETTE.pivot;
      this.addRect(x + 18 + i * 15, y + 60, 10, 2, tickerColor, i % 4 === 0 ? 0.84 : 0.46);
    }
  }

  private drawAegisSecurityStation(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    this.addRect(x + 16, y + 16, 48, 44, 0x351a1f);
    this.addRect(x + 22, y + 30, 36, 24, PALETTE.aegisRed, 0.35);
    this.addRect(x + 30, y + 20, 20, 10, PALETTE.aegis, 0.36);
    this.addRect(x + 34, y + 18, 12, 4, PALETTE.text, 0.22);
    this.addRect(x + 38, y + 38, 4, 8, 0x2a1216);

    this.addRect(x + 74, y + 16, 56, 44, 0x32161c);
    this.addRect(x + 92, y + 22, 20, 6, PALETTE.aegis, 0.44);
    this.addRect(x + 86, y + 28, 32, 20, PALETTE.aegisRed, 0.56);
    this.addRect(x + 90, y + 32, 24, 12, 0x2b1518, 0.9);
    this.addRect(x + 98, y + 34, 8, 8, PALETTE.aegis, 0.66);

    this.addRect(x + width - 48, y + 18, 22, 22, PALETTE.aegis, 0.22);
    this.addRect(x + width - 43, y + 23, 12, 12, PALETTE.aegisRed, 0.86);
    this.addRect(x + width - 39, y + 27, 4, 4, PALETTE.text, 0.86);

    this.addRect(x + 14, y + height - 26, width - 28, 12, 0x3a1b20);
    for (let i = 0; i < 8; i += 1) {
      const pulseColor = i % 2 === 0 ? PALETTE.aegisRed : PALETTE.aegis;
      this.addRect(x + 20 + i * 28, y + height - 22, 18, 3, pulseColor, 0.78);
    }
  }

  private drawResearcherLibrary(tileX: number, tileY: number, widthTiles: number, _heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;

    this.addRect(x + 10, y + 14, 34, 98, 0x322338);
    this.addRect(x + width - 44, y + 14, 34, 98, 0x322338);

    for (let shelf = 0; shelf < 5; shelf += 1) {
      const shelfY = y + 24 + shelf * 17;
      this.addRect(x + 12, shelfY, 30, 2, PALETTE.researcherPaper, 0.36);
      this.addRect(x + width - 42, shelfY, 30, 2, PALETTE.researcherPaper, 0.36);

      for (let book = 0; book < 5; book += 1) {
        const bookColor = book % 2 === 0 ? PALETTE.researcher : PALETTE.researcherPaper;
        this.addRect(x + 14 + book * 5, shelfY - 10, 3, 9, bookColor, 0.26 + book * 0.08);
        this.addRect(x + width - 40 + book * 5, shelfY - 10, 3, 9, bookColor, 0.22 + book * 0.08);
      }
    }

    this.addRect(x + 60, y + 24, 132, 54, 0x2d1f30);
    this.addRect(x + 62, y + 26, 128, 50, PALETTE.researcher, 0.14);
    this.addRect(x + 72, y + 34, 38, 20, PALETTE.researcherPaper, 0.82);
    this.addRect(x + 114, y + 39, 26, 17, PALETTE.researcherPaper, 0.75);
    this.addRect(x + 146, y + 31, 32, 22, PALETTE.researcherPaper, 0.8);
    this.addRect(x + 76, y + 38, 30, 2, PALETTE.researcher, 0.42);
    this.addRect(x + 116, y + 44, 22, 2, PALETTE.researcher, 0.35);
    this.addRect(x + 150, y + 36, 24, 2, PALETTE.researcher, 0.36);

    this.addRect(x + width - 64, y + 84, 16, 6, 0x3e2d1f);
    this.addRect(x + width - 57, y + 68, 2, 16, 0x7a6450);
    this.addRect(x + width - 62, y + 62, 12, 7, PALETTE.researcherPaper, 0.85);
    this.addRect(x + width - 60, y + 64, 8, 2, PALETTE.researcher, 0.32);
  }

  private drawContractorWorkstations(tileX: number, tileY: number, widthTiles: number, heightTiles: number): void {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const width = widthTiles * TILE_SIZE;
    const height = heightTiles * TILE_SIZE;

    for (let row = 0; row < 3; row += 1) {
      const rowY = y + 30 + row * 94;
      this.addRect(x + 12, rowY, width - 24, 14, 0x3a291f);
      this.addRect(x + 12, rowY, width - 24, 2, PALETTE.contractor, 0.52);
      this.addRect(x + 20, rowY + 14, width - 40, 2, PALETTE.border, 0.5);

      for (let seat = 0; seat < 4; seat += 1) {
        const seatX = x + 24 + seat * 70;
        this.addRect(seatX, rowY - 18, 22, 16, 0x312217);
        this.addRect(seatX + 2, rowY - 16, 18, 12, PALETTE.contractor, 0.26);
        this.addRect(seatX + 4, rowY - 10, 14, 2, PALETTE.contractor, 0.62);
      }
    }

    this.addRect(x + width - 40, y + 14, 20, height - 28, 0x3a271f);
    for (let i = 0; i < 8; i += 1) {
      this.addRect(x + width - 36, y + 24 + i * 20, 12, 2, PALETTE.contractor, 0.36);
    }
  }

  private drawDesk(tile: TilePoint, deskColor: number, accentColor: number): void {
    if (this.drawVendorDesk(tile)) {
      return;
    }

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

  private drawChair(tile: TilePoint, seatColor: number): void {
    if (this.drawVendorChair(tile)) {
      return;
    }

    const x = tile.x * TILE_SIZE + 8;
    const y = tile.y * TILE_SIZE + 10;

    this.addRect(x, y, 16, 10, seatColor);
    this.addRect(x + 2, y - 4, 12, 4, 0x3b2a22);
    this.addRect(x + 7, y + 10, 2, 6, 0x2a1c14);
  }

  private drawVendorDesk(tile: TilePoint): boolean {
    const originX = tile.x * TILE_SIZE;
    const originY = tile.y * TILE_SIZE - 8;
    const seed = this.tileSeed(tile.x, tile.y, 1);

    if (!this.drawVendorFurnitureTile("desks", originX, originY, seed)) {
      return false;
    }

    this.drawVendorFurnitureTile("monitors", originX + 8, originY - 10, seed + 11);
    return true;
  }

  private drawVendorChair(tile: TilePoint): boolean {
    const originX = tile.x * TILE_SIZE;
    const originY = tile.y * TILE_SIZE - 2;
    const seed = this.tileSeed(tile.x, tile.y, 2);
    return this.drawVendorFurnitureTile("chairs", originX, originY, seed);
  }

  private drawVendorAmbientDecor(): void {
    if (!this.vendorFurniture) {
      return;
    }

    const placements: Array<{ category: VendorFurnitureCategory; x: number; y: number; salt: number }> = [
      { category: "shelves", x: 2, y: 1, salt: 31 },
      { category: "shelves", x: 12, y: 1, salt: 32 },
      { category: "plants", x: 7, y: 2, salt: 33 },
      { category: "lamps", x: 9, y: 2, salt: 34 },
      { category: "decor", x: 3, y: 14, salt: 35 },
      { category: "decor", x: 14, y: 14, salt: 36 },
      { category: "plants", x: 17, y: 14, salt: 37 },
      { category: "lamps", x: 25, y: 14, salt: 38 },
      { category: "shelves", x: 25, y: 2, salt: 39 },
      { category: "decor", x: 20, y: 2, salt: 40 },
    ];

    for (const placement of placements) {
      const px = placement.x * TILE_SIZE;
      const py = placement.y * TILE_SIZE;
      const seed = this.tileSeed(placement.x, placement.y, placement.salt);
      this.drawVendorFurnitureTile(placement.category, px, py, seed, 0.95);
    }
  }

  private drawVendorFurnitureTile(
    category: VendorFurnitureCategory,
    x: number,
    y: number,
    seed: number,
    alpha = 1,
  ): boolean {
    if (!this.vendorFurniture || !this.backgroundLayer) {
      return false;
    }

    const textures = this.vendorFurniture.categories[category];
    if (!textures || textures.length === 0) {
      return false;
    }

    const index = Math.abs(seed) % textures.length;
    const sprite = new Sprite(textures[index]);
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.alpha = alpha;
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
