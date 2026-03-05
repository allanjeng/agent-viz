import { OFFICE_HEIGHT_TILES, OFFICE_WIDTH_TILES } from "./layout";
import { OFFICE_PALETTE } from "./theme";

export type PresetFloorColor = {
  h: number;
  s: number;
  b: number;
  c: number;
};

export type PresetFurniture = {
  uid: string;
  type: string;
  col: number;
  row: number;
  alpha?: number;
  tint?: number;
  offsetX?: number;
  offsetY?: number;
};

export type PresetZone = {
  id: "nexus" | "pivot" | "aegis" | "researcher" | "contractor";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: number;
};

export type PresetLayout = {
  version: 1;
  cols: number;
  rows: number;
  tiles: number[];
  tileColors: Array<PresetFloorColor | null>;
  furniture: PresetFurniture[];
};

export const PRESET_TILE = {
  WALL: 0,
  FLOOR_MAIN: 1,
  FLOOR_ALT: 2,
  FLOOR_COMMAND: 3,
  FLOOR_TRADING: 4,
  FLOOR_CONTRACTOR: 5,
  FLOOR_SECURITY: 6,
  FLOOR_RESEARCH: 7,
  VOID: 8,
} as const;

const TILE_COLOR_MAP: Record<number, PresetFloorColor | null> = {
  [PRESET_TILE.WALL]: null,
  [PRESET_TILE.FLOOR_MAIN]: { h: 34, s: 27, b: 18, c: 2 },
  [PRESET_TILE.FLOOR_ALT]: { h: 32, s: 31, b: 15, c: 4 },
  [PRESET_TILE.FLOOR_COMMAND]: { h: 31, s: 41, b: 8, c: 6 },
  [PRESET_TILE.FLOOR_TRADING]: { h: 35, s: 45, b: 5, c: 8 },
  [PRESET_TILE.FLOOR_CONTRACTOR]: { h: 29, s: 44, b: 2, c: 10 },
  [PRESET_TILE.FLOOR_SECURITY]: { h: 22, s: 34, b: 11, c: 8 },
  [PRESET_TILE.FLOOR_RESEARCH]: { h: 30, s: 23, b: 21, c: 2 },
  [PRESET_TILE.VOID]: null,
};

export const PRESET_ZONES: PresetZone[] = [
  {
    id: "nexus",
    label: "NEXUS COMMAND",
    x: 3,
    y: 3,
    width: 10,
    height: 7,
    accent: OFFICE_PALETTE.nexus,
  },
  {
    id: "pivot",
    label: "PIVOT TRADING",
    x: 16,
    y: 3,
    width: 10,
    height: 7,
    accent: OFFICE_PALETTE.pivot,
  },
  {
    id: "aegis",
    label: "AEGIS SECURITY",
    x: 3,
    y: 13,
    width: 10,
    height: 9,
    accent: OFFICE_PALETTE.aegis,
  },
  {
    id: "researcher",
    label: "RESEARCHER LIBRARY",
    x: 16,
    y: 13,
    width: 10,
    height: 9,
    accent: OFFICE_PALETTE.researcher,
  },
  {
    id: "contractor",
    label: "CONTRACTOR DESKS",
    x: 28,
    y: 3,
    width: 9,
    height: 19,
    accent: OFFICE_PALETTE.contractor,
  },
];

function cloneTileColor(tile: number): PresetFloorColor | null {
  const color = TILE_COLOR_MAP[tile];
  return color ? { ...color } : null;
}

function createPresetLayout(): PresetLayout {
  const cols = OFFICE_WIDTH_TILES;
  const rows = OFFICE_HEIGHT_TILES;
  const size = cols * rows;
  const tiles = new Array<number>(size).fill(PRESET_TILE.VOID);
  const tileColors: Array<PresetFloorColor | null> = new Array(size).fill(null);

  const setTile = (col: number, row: number, tile: number): void => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return;
    }

    const index = row * cols + col;
    tiles[index] = tile;
    tileColors[index] = cloneTileColor(tile);
  };

  const fillRect = (x: number, y: number, width: number, height: number, tile: number): void => {
    for (let row = y; row < y + height; row += 1) {
      for (let col = x; col < x + width; col += 1) {
        setTile(col, row, tile);
      }
    }
  };

  const verticalWall = (col: number, rowStart: number, rowEnd: number, openings: Set<number>): void => {
    for (let row = rowStart; row <= rowEnd; row += 1) {
      if (openings.has(row)) {
        setTile(col, row, PRESET_TILE.FLOOR_ALT);
      } else {
        setTile(col, row, PRESET_TILE.WALL);
      }
    }
  };

  const horizontalWall = (row: number, colStart: number, colEnd: number, openings: Set<number>): void => {
    for (let col = colStart; col <= colEnd; col += 1) {
      if (openings.has(col)) {
        setTile(col, row, PRESET_TILE.FLOOR_ALT);
      } else {
        setTile(col, row, PRESET_TILE.WALL);
      }
    }
  };

  fillRect(2, 2, cols - 4, rows - 4, PRESET_TILE.FLOOR_MAIN);

  horizontalWall(1, 1, cols - 2, new Set());
  horizontalWall(rows - 2, 1, cols - 2, new Set([cols - 2]));
  verticalWall(1, 1, rows - 2, new Set());
  verticalWall(cols - 2, 1, rows - 2, new Set([20, 21]));

  fillRect(2, 10, cols - 4, 2, PRESET_TILE.FLOOR_ALT);
  fillRect(29, 3, 2, 19, PRESET_TILE.FLOOR_ALT);
  fillRect(33, 3, 2, 19, PRESET_TILE.FLOOR_ALT);

  fillRect(3, 3, 10, 7, PRESET_TILE.FLOOR_COMMAND);
  fillRect(16, 3, 10, 7, PRESET_TILE.FLOOR_TRADING);
  fillRect(3, 13, 10, 9, PRESET_TILE.FLOOR_SECURITY);
  fillRect(16, 13, 10, 9, PRESET_TILE.FLOOR_RESEARCH);
  fillRect(28, 3, 9, 19, PRESET_TILE.FLOOR_CONTRACTOR);

  verticalWall(14, 2, 23, new Set([6, 7, 17, 18]));
  verticalWall(27, 2, 23, new Set([8, 9, 16, 17]));
  horizontalWall(12, 2, 26, new Set([8, 9, 20, 21]));

  fillRect(cols - 4, 20, 2, 2, PRESET_TILE.FLOOR_ALT);
  fillRect(2, 20, 5, 2, PRESET_TILE.FLOOR_ALT);

  const furniture: PresetFurniture[] = [
    { uid: "nexus-console", type: "tech_console_long", col: 4, row: 4, alpha: 0.9, tint: 0xf1c18e },
    { uid: "nexus-monitor", type: "lab_terminal_panel", col: 10, row: 8, alpha: 0.9, tint: 0xffd2a3 },
    { uid: "nexus-lamp", type: "lab_study_lamp", col: 10, row: 4, alpha: 0.88, tint: 0xffe2bc },

    { uid: "pivot-board", type: "tech_trading_board", col: 17, row: 4, alpha: 0.9, tint: 0xc7d58c },
    { uid: "pivot-ticker", type: "tech_ticker_strip", col: 16, row: 6, alpha: 0.9, tint: 0xbfd089 },
    { uid: "pivot-chart", type: "tech_chart_panel", col: 23, row: 8, alpha: 0.92, tint: 0xcdde95 },

    { uid: "aegis-server-top", type: "tech_server_top", col: 4, row: 14, alpha: 0.88, tint: 0xe7a09c },
    { uid: "aegis-gate-left", type: "tech_gate_left", col: 9, row: 14, alpha: 0.9, tint: 0xd6908a },
    { uid: "aegis-gate-right", type: "tech_gate_right", col: 12, row: 14, alpha: 0.9, tint: 0xd6908a },
    { uid: "aegis-gate-bottom", type: "tech_gate_bottom", col: 9, row: 17, alpha: 0.9, tint: 0xd6908a },
    { uid: "aegis-door", type: "lab_security_door", col: 4, row: 19, alpha: 0.9, tint: 0xf0b2a8 },

    { uid: "research-shelf-a", type: "lab_archive_wide_a", col: 16, row: 14, alpha: 0.92, tint: 0xf1e7ff },
    { uid: "research-shelf-b", type: "lab_archive_wide_b", col: 16, row: 18, alpha: 0.92, tint: 0xe8d9ff },
    { uid: "research-shelf-left", type: "lab_archive_left", col: 22, row: 14, alpha: 0.92, tint: 0xe7d6ff },
    { uid: "research-shelf-right", type: "lab_archive_right", col: 22, row: 18, alpha: 0.92, tint: 0xe7d6ff },
    { uid: "research-terminal", type: "tech_terminal_small", col: 23, row: 17, alpha: 0.9, tint: 0xddd0ff },

    { uid: "hotdesk-divider-1a", type: "lab_partition_low", col: 28, row: 5, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-1b", type: "lab_partition_low", col: 32, row: 5, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-2a", type: "lab_partition_low", col: 28, row: 9, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-2b", type: "lab_partition_low", col: 32, row: 9, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-3a", type: "lab_partition_low", col: 28, row: 13, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-3b", type: "lab_partition_low", col: 32, row: 13, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-4a", type: "lab_partition_low", col: 28, row: 17, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-divider-4b", type: "lab_partition_low", col: 32, row: 17, alpha: 0.82, tint: 0xe7c29d },
    { uid: "hotdesk-bench", type: "tech_floor_bench", col: 30, row: 21, alpha: 0.82, tint: 0xdfb088 },

    {
      uid: "lamp-left",
      type: "lab_hanging_lamp",
      col: 6,
      row: 2,
      offsetY: -20,
      alpha: 0.7,
      tint: 0xffddb0,
    },
    {
      uid: "lamp-center-left",
      type: "lab_hanging_lamp",
      col: 16,
      row: 2,
      offsetY: -20,
      alpha: 0.7,
      tint: 0xffddb0,
    },
    {
      uid: "lamp-center-right",
      type: "lab_hanging_lamp",
      col: 26,
      row: 2,
      offsetY: -20,
      alpha: 0.68,
      tint: 0xffd39c,
    },
    {
      uid: "lamp-right",
      type: "lab_hanging_lamp",
      col: 32,
      row: 2,
      offsetY: -20,
      alpha: 0.66,
      tint: 0xffd39c,
    },
  ];

  return {
    version: 1,
    cols,
    rows,
    tiles,
    tileColors,
    furniture,
  };
}

export const METRO_PRESET_LAYOUT = createPresetLayout();
