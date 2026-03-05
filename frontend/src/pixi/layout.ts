export const TILE_SIZE = 32;
export const OFFICE_WIDTH_TILES = 33;
export const OFFICE_HEIGHT_TILES = 20;

export type TilePoint = {
  x: number;
  y: number;
};

export const PERSISTENT_DESKS: Record<string, TilePoint> = {
  nexus: { x: 5, y: 6 },
  pivot: { x: 14, y: 6 },
  aegis: { x: 5, y: 14 },
  researcher: { x: 14, y: 14 },
};

export const CONTRACTOR_DESKS: TilePoint[] = [
  { x: 24, y: 5 },
  { x: 28, y: 5 },
  { x: 24, y: 9 },
  { x: 28, y: 9 },
  { x: 24, y: 13 },
  { x: 28, y: 13 },
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
