export const TILE_SIZE = 32;
export const OFFICE_WIDTH_TILES = 40;
export const OFFICE_HEIGHT_TILES = 24;

export type TilePoint = {
  x: number;
  y: number;
};

export const PERSISTENT_DESKS: Record<string, TilePoint> = {
  nexus: { x: 6, y: 7 },
  pivot: { x: 18, y: 7 },
  aegis: { x: 6, y: 17 },
  researcher: { x: 18, y: 17 },
};

export const CONTRACTOR_DESKS: TilePoint[] = [
  { x: 29, y: 6 },
  { x: 34, y: 6 },
  { x: 29, y: 11 },
  { x: 34, y: 11 },
  { x: 29, y: 16 },
  { x: 34, y: 16 },
];

export const ENTRY_POINT = {
  x: OFFICE_WIDTH_TILES * TILE_SIZE - TILE_SIZE * 0.8,
  y: OFFICE_HEIGHT_TILES * TILE_SIZE - TILE_SIZE * 1.1,
};

export function deskToAgentPosition(tile: TilePoint): { x: number; y: number } {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: tile.y * TILE_SIZE + TILE_SIZE * 0.96,
  };
}
