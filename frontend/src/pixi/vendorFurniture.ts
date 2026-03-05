import { Assets, Rectangle, Texture } from "pixi.js";

const CATEGORIES = ["desks", "chairs", "monitors", "shelves", "plants", "lamps", "decor"] as const;

export type VendorFurnitureCategory = (typeof CATEGORIES)[number];

type AtlasFrame = {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

type VendorAtlasJson = {
  categories: Partial<Record<VendorFurnitureCategory, string[]>>;
  frames: Record<string, AtlasFrame>;
  meta: {
    image: string;
  };
};

export type VendorFurnitureAtlas = {
  categories: Record<VendorFurnitureCategory, Texture[]>;
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseAtlasJson(value: unknown): VendorAtlasJson | null {
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
    categories: categories as Partial<Record<VendorFurnitureCategory, string[]>>,
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

export async function loadVendorFurnitureAtlas(): Promise<VendorFurnitureAtlas | null> {
  try {
    const response = await fetch("/assets/vendor/furniture.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const parsed = parseAtlasJson(await response.json());
    if (!parsed) {
      return null;
    }

    const sheet = await Assets.load({
      src: `/assets/vendor/${parsed.meta.image}`,
      data: { scaleMode: "nearest" },
    }) as Texture;

    sheet.source.scaleMode = "nearest";

    const categoryTextures = Object.fromEntries(
      CATEGORIES.map((category) => {
        const names = parsed.categories[category] ?? [];
        const textures = names
          .map((name) => frameTexture(sheet, parsed.frames[name]))
          .filter((texture): texture is Texture => texture !== null);
        return [category, textures];
      }),
    ) as Record<VendorFurnitureCategory, Texture[]>;

    const hasAny = CATEGORIES.some((category) => categoryTextures[category].length > 0);
    if (!hasAny) {
      return null;
    }

    return {
      categories: categoryTextures,
    };
  } catch {
    return null;
  }
}
