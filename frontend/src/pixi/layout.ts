export const TILE_SIZE = 32;
export const OFFICE_WIDTH_TILES = 44;
export const OFFICE_HEIGHT_TILES = 26;

export type TilePoint = {
  x: number;
  y: number;
};

export const PERSISTENT_DESKS: Record<string, TilePoint> = {
  nexus: { x: 7, y: 7 },
  pivot: { x: 20, y: 7 },
  aegis: { x: 7, y: 18 },
  researcher: { x: 20, y: 18 },
};

export const CONTRACTOR_DESKS: TilePoint[] = [
  { x: 31, y: 6 },
  { x: 36, y: 6 },
  { x: 31, y: 10 },
  { x: 36, y: 10 },
  { x: 31, y: 14 },
  { x: 36, y: 14 },
  { x: 31, y: 18 },
  { x: 36, y: 18 },
];

export const ENTRY_POINT = {
  x: OFFICE_WIDTH_TILES * TILE_SIZE - TILE_SIZE * 0.9,
  y: (OFFICE_HEIGHT_TILES - 4.8) * TILE_SIZE,
};

export function deskToAgentPosition(tile: TilePoint): { x: number; y: number } {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.96,
  };
}
