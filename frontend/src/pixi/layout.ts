export const TILE_SIZE = 32;
export const OFFICE_WIDTH_TILES = 28;
export const OFFICE_HEIGHT_TILES = 17;

export type TilePoint = {
  x: number;
  y: number;
};

export const PERSISTENT_DESKS: Record<string, TilePoint> = {
  nexus: { x: 4, y: 4 },
  pivot: { x: 10, y: 4 },
  aegis: { x: 4, y: 10 },
  researcher: { x: 10, y: 10 },
};

export const CONTRACTOR_DESKS: TilePoint[] = [
  { x: 18, y: 4 },
  { x: 23, y: 4 },
  { x: 18, y: 7 },
  { x: 23, y: 7 },
  { x: 18, y: 10 },
  { x: 23, y: 10 },
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
