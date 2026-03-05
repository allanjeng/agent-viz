import { Assets, Rectangle, Texture } from "pixi.js";

const CATEGORIES = [
  "floor",
  "walls",
  "rugs",
  "desks",
  "monitors",
  "shelves",
  "lamps",
  "decor",
  "command",
  "trading",
  "security",
  "research",
  "hotdesk",
] as const;

export type FreeFurnitureCategory = (typeof CATEGORIES)[number];

type AtlasFrame = {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

type FreeAtlasJson = {
  categories: Partial<Record<FreeFurnitureCategory, string[]>>;
  frames: Record<string, AtlasFrame>;
  meta: {
    image: string;
  };
};

export type FreeFurnitureAtlas = {
  categories: Record<FreeFurnitureCategory, Texture[]>;
  named: Record<string, Texture>;
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseAtlasJson(value: unknown): FreeAtlasJson | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const meta = raw.meta;
  const frames = raw.frames;
  const categories = raw.categories;

  if (!meta || typeof meta !== "object") {
    return null;
  }

  const image = (meta as Record<string, unknown>).image;
  if (typeof image !== "string" || image.length === 0) {
    return null;
  }

  if (!frames || typeof frames !== "object") {
    return null;
  }

  if (!categories || typeof categories !== "object") {
    return null;
  }

  return {
    meta: { image },
    frames: frames as Record<string, AtlasFrame>,
    categories: categories as Partial<Record<FreeFurnitureCategory, string[]>>,
  };
}

function frameTexture(sheet: Texture, frameData: AtlasFrame | undefined): Texture | null {
  if (!frameData || !frameData.frame || typeof frameData.frame !== "object") {
    return null;
  }

  const x = toFiniteNumber(frameData.frame.x);
  const y = toFiniteNumber(frameData.frame.y);
  const w = toFiniteNumber(frameData.frame.w);
  const h = toFiniteNumber(frameData.frame.h);

  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) {
    return null;
  }

  return new Texture({
    source: sheet.source,
    frame: new Rectangle(x, y, w, h),
  });
}

export async function loadFreeFurnitureAtlas(): Promise<FreeFurnitureAtlas | null> {
  try {
    const response = await fetch("/assets/free/office.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const parsed = parseAtlasJson(await response.json());
    if (!parsed) {
      return null;
    }

    const sheet = await Assets.load({
      src: `/assets/free/${parsed.meta.image}`,
      data: { scaleMode: "nearest" },
    }) as Texture;

    sheet.source.scaleMode = "nearest";

    const named: Record<string, Texture> = {};
    for (const [name, frameData] of Object.entries(parsed.frames)) {
      const texture = frameTexture(sheet, frameData);
      if (texture) {
        named[name] = texture;
      }
    }

    const categoryTextures = Object.fromEntries(
      CATEGORIES.map((category) => {
        const names = parsed.categories[category] ?? [];
        const textures = names.map((name) => named[name]).filter((texture): texture is Texture => texture != null);
        return [category, textures];
      }),
    ) as Record<FreeFurnitureCategory, Texture[]>;

    const hasAny = CATEGORIES.some((category) => categoryTextures[category].length > 0);
    if (!hasAny) {
      return null;
    }

    return {
      categories: categoryTextures,
      named,
    };
  } catch {
    return null;
  }
}
