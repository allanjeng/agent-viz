#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[agent-viz] Missing dependency: Pillow. Install it with `pip install pillow`.")
    raise SystemExit(2)


REPO_ROOT = Path(__file__).resolve().parents[1]
VENDOR_ROOT = REPO_ROOT / "assets" / "vendor"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "assets" / "vendor"

TARGET_TILE_SIZE = 32
REQUIRED_CATEGORIES = (
    "desks",
    "chairs",
    "monitors",
    "shelves",
    "plants",
    "lamps",
    "decor",
)


SOURCE_CONFIG = {
    "donarg": {
        "dir": "donarg",
        "png": "donarg-office-tileset.png",
        "zip": "Donarg-Office-Tileset.zip",
        "tile_size": 16,
    },
    "cozy": {
        "dir": "cozy-furniture",
        "png": "cozy-furniture-tileset.png",
        "zip": "Cozy-Furniture.zip",
        "tile_size": 16,
    },
}


@dataclass(frozen=True)
class TileRef:
    source: str
    tx: int
    ty: int
    category: str
    name: str


# Coordinates are in tile units on each source sheet.
EXTRACTION_PLAN: tuple[TileRef, ...] = (
    TileRef("donarg", 0, 0, "desks", "donarg_desk_0"),
    TileRef("donarg", 1, 0, "desks", "donarg_desk_1"),
    TileRef("cozy", 0, 1, "desks", "cozy_desk_0"),
    TileRef("cozy", 1, 1, "desks", "cozy_desk_1"),
    TileRef("donarg", 2, 0, "chairs", "donarg_chair_0"),
    TileRef("donarg", 3, 0, "chairs", "donarg_chair_1"),
    TileRef("cozy", 2, 1, "chairs", "cozy_chair_0"),
    TileRef("cozy", 3, 1, "chairs", "cozy_chair_1"),
    TileRef("donarg", 4, 0, "monitors", "donarg_monitor_0"),
    TileRef("donarg", 5, 0, "monitors", "donarg_monitor_1"),
    TileRef("cozy", 4, 1, "monitors", "cozy_monitor_0"),
    TileRef("donarg", 0, 2, "shelves", "donarg_shelf_0"),
    TileRef("donarg", 1, 2, "shelves", "donarg_shelf_1"),
    TileRef("cozy", 0, 3, "shelves", "cozy_shelf_0"),
    TileRef("cozy", 1, 3, "shelves", "cozy_shelf_1"),
    TileRef("cozy", 2, 3, "plants", "cozy_plant_0"),
    TileRef("cozy", 3, 3, "plants", "cozy_plant_1"),
    TileRef("donarg", 2, 2, "plants", "donarg_plant_0"),
    TileRef("cozy", 4, 3, "lamps", "cozy_lamp_0"),
    TileRef("cozy", 5, 3, "lamps", "cozy_lamp_1"),
    TileRef("donarg", 3, 2, "lamps", "donarg_lamp_0"),
    TileRef("cozy", 6, 1, "decor", "cozy_decor_0"),
    TileRef("cozy", 7, 1, "decor", "cozy_decor_1"),
    TileRef("donarg", 6, 0, "decor", "donarg_decor_0"),
    TileRef("donarg", 7, 0, "decor", "donarg_decor_1"),
)


def nearest_mode() -> int:
    return getattr(Image, "Resampling", Image).NEAREST


def fail(msg: str) -> int:
    print(f"[agent-viz] {msg}")
    return 1


def maybe_extract_zip(source_name: str, source_dir: Path, zip_name: str, png_name: str) -> None:
    png_path = source_dir / png_name
    if png_path.exists():
        return

    zip_path = source_dir / zip_name
    if not zip_path.exists():
        return

    with zipfile.ZipFile(zip_path, "r") as archive:
        candidates = [
            info
            for info in archive.infolist()
            if not info.is_dir()
            and info.filename.lower().endswith(".png")
            and "__macosx" not in info.filename.lower()
        ]

        if not candidates:
            return

        preferred = [
            info
            for info in candidates
            if any(token in info.filename.lower() for token in ("tile", "sheet", "furniture", "office"))
        ]
        picked = preferred[0] if preferred else candidates[0]

        data = archive.read(picked)
        png_path.write_bytes(data)
        print(f"[agent-viz] extracted {picked.filename} -> {source_name}/{png_name}")


def load_sources() -> tuple[dict[str, Image.Image], dict[str, dict[str, int | str]]] | None:
    images: dict[str, Image.Image] = {}
    source_meta: dict[str, dict[str, int | str]] = {}
    missing: list[str] = []

    for source_name, cfg in SOURCE_CONFIG.items():
        source_dir = VENDOR_ROOT / str(cfg["dir"])
        png_name = str(cfg["png"])
        zip_name = str(cfg["zip"])
        tile_size = int(cfg["tile_size"])

        maybe_extract_zip(source_name, source_dir, zip_name, png_name)

        png_path = source_dir / png_name
        if not png_path.exists():
            missing.append(
                "\n".join(
                    [
                        f"Missing source png: {png_path}",
                        f"Provide either {source_dir / zip_name} or {png_path}.",
                        "See assets/vendor/README.md for exact filenames.",
                    ]
                )
            )
            continue

        image = Image.open(png_path).convert("RGBA")
        images[source_name] = image
        source_meta[source_name] = {
            "file": png_name,
            "tileSize": tile_size,
            "width": image.width,
            "height": image.height,
        }

    if missing:
        for item in missing:
            print(f"[agent-viz] {item}")
        return None

    return images, source_meta


def crop_tile(image: Image.Image, tile_size: int, tx: int, ty: int) -> Image.Image | None:
    left = tx * tile_size
    top = ty * tile_size
    right = left + tile_size
    bottom = top + tile_size

    if left < 0 or top < 0 or right > image.width or bottom > image.height:
        return None

    tile = image.crop((left, top, right, bottom))
    if tile_size != TARGET_TILE_SIZE:
        tile = tile.resize((TARGET_TILE_SIZE, TARGET_TILE_SIZE), nearest_mode())
    return tile


def build_atlas(extracted: list[tuple[TileRef, Image.Image]]) -> tuple[Image.Image, dict[str, object]]:
    columns = 8
    rows = (len(extracted) + columns - 1) // columns
    atlas = Image.new("RGBA", (columns * TARGET_TILE_SIZE, rows * TARGET_TILE_SIZE), (0, 0, 0, 0))

    frames: dict[str, dict[str, object]] = {}
    categories = {category: [] for category in REQUIRED_CATEGORIES}

    for index, (ref, tile) in enumerate(extracted):
        x = (index % columns) * TARGET_TILE_SIZE
        y = (index // columns) * TARGET_TILE_SIZE
        atlas.paste(tile, (x, y))

        frames[ref.name] = {
            "frame": {"x": x, "y": y, "w": TARGET_TILE_SIZE, "h": TARGET_TILE_SIZE},
            "sourceSize": {"w": TARGET_TILE_SIZE, "h": TARGET_TILE_SIZE},
            "spriteSourceSize": {"x": 0, "y": 0, "w": TARGET_TILE_SIZE, "h": TARGET_TILE_SIZE},
        }
        categories[ref.category].append(ref.name)

    manifest = {
        "version": 1,
        "kind": "agent-viz-vendor-furniture",
        "categories": categories,
        "frames": frames,
        "meta": {
            "image": "furniture.png",
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
        },
    }

    return atlas, manifest


def run() -> int:
    loaded = load_sources()
    if not loaded:
        return 1

    sources, source_meta = loaded

    extracted: list[tuple[TileRef, Image.Image]] = []
    skipped: list[str] = []

    for ref in EXTRACTION_PLAN:
        source_image = sources.get(ref.source)
        source_cfg = SOURCE_CONFIG.get(ref.source)

        if source_image is None or source_cfg is None:
            skipped.append(f"{ref.name} (missing source {ref.source})")
            continue

        tile = crop_tile(
            image=source_image,
            tile_size=int(source_cfg["tile_size"]),
            tx=ref.tx,
            ty=ref.ty,
        )
        if tile is None:
            skipped.append(f"{ref.name} ({ref.source} tile {ref.tx},{ref.ty} out of bounds)")
            continue

        extracted.append((ref, tile))

    if not extracted:
        return fail(
            "No vendor tiles were extracted. Check sheet filenames, tile sizes, and extraction coordinates in scripts/import_vendor_assets.py."
        )

    per_category_counts = {category: 0 for category in REQUIRED_CATEGORIES}
    for ref, _ in extracted:
        per_category_counts[ref.category] += 1

    missing_categories = [category for category, count in per_category_counts.items() if count == 0]
    if missing_categories:
        print(f"[agent-viz] Missing required categories after extraction: {', '.join(missing_categories)}")
        print("[agent-viz] Update EXTRACTION_PLAN coordinates in scripts/import_vendor_assets.py to match your sheet layout.")
        return 1

    atlas, manifest = build_atlas(extracted)
    manifest["source"] = source_meta

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas_path = OUTPUT_DIR / "furniture.png"
    json_path = OUTPUT_DIR / "furniture.json"

    atlas.save(atlas_path)
    json_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"[agent-viz] wrote {atlas_path}")
    print(f"[agent-viz] wrote {json_path}")
    print("[agent-viz] category counts:")
    for category in REQUIRED_CATEGORIES:
        print(f"  - {category}: {per_category_counts[category]}")

    if skipped:
        print("[agent-viz] skipped tiles:")
        for note in skipped:
            print(f"  - {note}")

    return 0


def main() -> None:
    try:
        raise SystemExit(run())
    except KeyboardInterrupt:
        print("[agent-viz] interrupted")
        raise SystemExit(130)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[agent-viz] Import failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
