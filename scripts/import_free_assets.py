#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[agent-viz] Missing dependency: Pillow. Install it with `pip install pillow`.")
    raise SystemExit(2)


REPO_ROOT = Path(__file__).resolve().parents[1]
FREE_SOURCE_ROOT = REPO_ROOT / "assets" / "free-sources" / "opengameart"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "assets" / "free"

TARGET_TILE_SIZE = 32
ATLAS_WIDTH = 1024

CATEGORIES = (
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
)


SOURCE_CONFIG = {
    "lab": {
        "path": FREE_SOURCE_ROOT / "lab-office" / "bgtiles_1.png",
        "tile_size": 16,
    },
    "tech": {
        "path": FREE_SOURCE_ROOT / "warped-tech-lab" / "extracted" / "Top Down Lab files" / "Tileset.png",
        "tile_size": 16,
    },
}


@dataclass(frozen=True)
class FrameRef:
    source: str
    tx: int
    ty: int
    tw: int
    th: int
    category: str
    name: str


EXTRACTION_PLAN: tuple[FrameRef, ...] = (
    # Warm floor tiles from Pixel Art Lab / Office tiles.
    FrameRef("lab", 4, 14, 1, 1, "floor", "lab_floor_wood_a"),
    FrameRef("lab", 5, 14, 1, 1, "floor", "lab_floor_wood_b"),
    FrameRef("lab", 4, 15, 1, 1, "floor", "lab_floor_wood_c"),
    FrameRef("lab", 5, 15, 1, 1, "floor", "lab_floor_wood_d"),
    FrameRef("lab", 6, 14, 1, 1, "floor", "lab_floor_copper_a"),
    FrameRef("lab", 7, 14, 1, 1, "floor", "lab_floor_copper_b"),
    FrameRef("lab", 6, 15, 1, 1, "floor", "lab_floor_copper_c"),
    FrameRef("lab", 7, 15, 1, 1, "floor", "lab_floor_copper_d"),
    FrameRef("lab", 4, 10, 1, 1, "floor", "lab_floor_soft_a"),
    FrameRef("lab", 5, 10, 1, 1, "floor", "lab_floor_soft_b"),
    FrameRef("lab", 4, 11, 1, 1, "floor", "lab_floor_soft_c"),
    FrameRef("lab", 5, 11, 1, 1, "floor", "lab_floor_soft_d"),
    # Walls and trims.
    FrameRef("lab", 10, 12, 1, 1, "walls", "lab_wall_trim_a"),
    FrameRef("lab", 11, 12, 1, 1, "walls", "lab_wall_trim_b"),
    FrameRef("lab", 12, 12, 1, 1, "walls", "lab_wall_trim_c"),
    FrameRef("lab", 13, 12, 1, 1, "walls", "lab_wall_trim_d"),
    FrameRef("lab", 10, 14, 1, 1, "walls", "lab_wall_panel_a"),
    FrameRef("lab", 11, 14, 1, 1, "walls", "lab_wall_panel_b"),
    FrameRef("lab", 12, 14, 1, 1, "walls", "lab_wall_panel_c"),
    FrameRef("lab", 13, 14, 1, 1, "walls", "lab_wall_panel_d"),
    FrameRef("lab", 10, 15, 1, 1, "walls", "lab_wall_panel_e"),
    FrameRef("lab", 11, 15, 1, 1, "walls", "lab_wall_panel_f"),
    FrameRef("lab", 0, 14, 1, 1, "walls", "lab_window_a"),
    FrameRef("lab", 1, 14, 1, 1, "walls", "lab_window_b"),
    FrameRef("lab", 0, 15, 1, 1, "walls", "lab_window_c"),
    FrameRef("lab", 1, 15, 1, 1, "walls", "lab_window_d"),
    # Large rugs.
    FrameRef("lab", 10, 0, 6, 6, "rugs", "lab_rug_green"),
    FrameRef("lab", 10, 7, 6, 6, "rugs", "lab_rug_plum"),
    # Shelves and study pieces.
    FrameRef("lab", 4, 12, 6, 2, "shelves", "lab_archive_wide_a"),
    FrameRef("lab", 4, 11, 6, 2, "shelves", "lab_archive_wide_b"),
    FrameRef("lab", 4, 12, 3, 2, "research", "lab_archive_left"),
    FrameRef("lab", 7, 12, 3, 2, "research", "lab_archive_right"),
    FrameRef("lab", 4, 7, 3, 1, "lamps", "lab_study_lamp"),
    FrameRef("lab", 6, 0, 2, 3, "lamps", "lab_hanging_lamp"),
    FrameRef("lab", 4, 7, 3, 1, "desks", "lab_table_small"),
    FrameRef("lab", 0, 9, 3, 2, "decor", "lab_bike_decor"),
    FrameRef("lab", 8, 14, 2, 2, "security", "lab_security_door"),
    FrameRef("lab", 9, 14, 1, 2, "decor", "lab_terminal_panel"),
    FrameRef("lab", 0, 8, 4, 1, "hotdesk", "lab_partition"),
    FrameRef("lab", 0, 10, 4, 1, "hotdesk", "lab_partition_low"),
    # Warped Top-Down Tech Lab workstation pieces.
    FrameRef("tech", 1, 1, 8, 3, "command", "tech_console_long"),
    FrameRef("tech", 1, 1, 4, 3, "desks", "tech_console_left"),
    FrameRef("tech", 5, 1, 4, 3, "desks", "tech_console_right"),
    FrameRef("tech", 3, 7, 4, 1, "desks", "tech_vent_desk"),
    FrameRef("tech", 1, 1, 2, 2, "monitors", "tech_display_left"),
    FrameRef("tech", 5, 1, 2, 2, "monitors", "tech_display_mid"),
    FrameRef("tech", 7, 1, 2, 3, "monitors", "tech_chip_panel"),
    FrameRef("tech", 5, 2, 2, 1, "monitors", "tech_indicator_strip"),
    FrameRef("tech", 1, 1, 6, 2, "trading", "tech_trading_board"),
    FrameRef("tech", 1, 2, 8, 1, "trading", "tech_ticker_strip"),
    FrameRef("tech", 7, 1, 2, 2, "trading", "tech_chart_panel"),
    FrameRef("tech", 10, 1, 4, 2, "security", "tech_server_top"),
    FrameRef("tech", 10, 3, 4, 6, "security", "tech_server_frame"),
    FrameRef("tech", 10, 3, 1, 4, "security", "tech_gate_left"),
    FrameRef("tech", 13, 3, 1, 4, "security", "tech_gate_right"),
    FrameRef("tech", 10, 7, 4, 2, "security", "tech_gate_bottom"),
    FrameRef("tech", 5, 1, 2, 2, "research", "tech_terminal_small"),
    FrameRef("tech", 3, 8, 5, 1, "hotdesk", "tech_hotdesk_strip"),
    FrameRef("tech", 10, 8, 4, 1, "hotdesk", "tech_floor_bench"),
    FrameRef("tech", 3, 4, 1, 5, "decor", "tech_caution_left"),
    FrameRef("tech", 7, 4, 1, 5, "decor", "tech_caution_right"),
    FrameRef("tech", 10, 8, 4, 2, "decor", "tech_machine_lower"),
    FrameRef("tech", 1, 4, 1, 1, "floor", "tech_floor_a"),
    FrameRef("tech", 2, 4, 1, 1, "floor", "tech_floor_b"),
    FrameRef("tech", 1, 5, 1, 1, "floor", "tech_floor_c"),
    FrameRef("tech", 2, 5, 1, 1, "floor", "tech_floor_d"),
    FrameRef("tech", 1, 6, 1, 1, "floor", "tech_floor_e"),
    FrameRef("tech", 2, 6, 1, 1, "floor", "tech_floor_f"),
    FrameRef("tech", 1, 8, 1, 1, "floor", "tech_floor_g"),
    FrameRef("tech", 2, 8, 1, 1, "floor", "tech_floor_h"),
    FrameRef("tech", 10, 1, 4, 1, "walls", "tech_wall_top"),
    FrameRef("tech", 10, 3, 1, 2, "walls", "tech_wall_side_l"),
    FrameRef("tech", 13, 3, 1, 2, "walls", "tech_wall_side_r"),
    FrameRef("tech", 10, 8, 4, 1, "walls", "tech_wall_bottom"),
)


def fail(msg: str) -> int:
    print(f"[agent-viz] {msg}")
    return 1


def nearest_mode() -> int:
    return getattr(Image, "Resampling", Image).NEAREST


def load_sources() -> tuple[dict[str, Image.Image], dict[str, dict[str, object]]] | None:
    images: dict[str, Image.Image] = {}
    source_meta: dict[str, dict[str, object]] = {}

    missing = []
    for key, cfg in SOURCE_CONFIG.items():
        path = cfg["path"]
        if not path.exists():
            missing.append(str(path))
            continue

        image = Image.open(path).convert("RGBA")
        images[key] = image
        source_meta[key] = {
            "file": str(path.relative_to(REPO_ROOT)),
            "tileSize": cfg["tile_size"],
            "width": image.width,
            "height": image.height,
        }

    if missing:
        for item in missing:
            print(f"[agent-viz] Missing source image: {item}")
        return None

    return images, source_meta


def extract_frame(image: Image.Image, tile_size: int, ref: FrameRef) -> Image.Image | None:
    left = ref.tx * tile_size
    top = ref.ty * tile_size
    right = left + (ref.tw * tile_size)
    bottom = top + (ref.th * tile_size)

    if left < 0 or top < 0 or right > image.width or bottom > image.height:
        return None

    frame = image.crop((left, top, right, bottom))

    scale = TARGET_TILE_SIZE / tile_size
    if abs(scale - 1) > 1e-6:
        frame = frame.resize(
            (int(round(frame.width * scale)), int(round(frame.height * scale))),
            nearest_mode(),
        )

    return frame


def pack_frames(frames: list[tuple[FrameRef, Image.Image]]) -> tuple[Image.Image, dict[str, object]]:
    placements: list[tuple[FrameRef, Image.Image, int, int]] = []
    x = 0
    y = 0
    row_height = 0

    for ref, image in frames:
        if image.width > ATLAS_WIDTH:
            raise ValueError(f"Frame {ref.name} wider than atlas width ({image.width}>{ATLAS_WIDTH})")

        if x + image.width > ATLAS_WIDTH:
            x = 0
            y += row_height
            row_height = 0

        placements.append((ref, image, x, y))
        x += image.width
        row_height = max(row_height, image.height)

    atlas_height = max(1, y + row_height)
    atlas = Image.new("RGBA", (ATLAS_WIDTH, atlas_height), (0, 0, 0, 0))

    categories = {category: [] for category in CATEGORIES}
    frames_json: dict[str, object] = {}

    for ref, image, fx, fy in placements:
        atlas.paste(image, (fx, fy))
        categories[ref.category].append(ref.name)
        frames_json[ref.name] = {
            "frame": {"x": fx, "y": fy, "w": image.width, "h": image.height},
            "sourceSize": {"w": image.width, "h": image.height},
            "spriteSourceSize": {"x": 0, "y": 0, "w": image.width, "h": image.height},
        }

    manifest = {
        "version": 1,
        "kind": "agent-viz-free-office",
        "categories": categories,
        "frames": frames_json,
        "meta": {
            "image": "office.png",
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

    extracted: list[tuple[FrameRef, Image.Image]] = []
    skipped: list[str] = []

    for ref in EXTRACTION_PLAN:
        source_cfg = SOURCE_CONFIG.get(ref.source)
        source_image = sources.get(ref.source)
        if not source_cfg or source_image is None:
            skipped.append(f"{ref.name} (missing source {ref.source})")
            continue

        image = extract_frame(source_image, int(source_cfg["tile_size"]), ref)
        if image is None:
            skipped.append(f"{ref.name} ({ref.source} rect {ref.tx},{ref.ty} {ref.tw}x{ref.th} out of bounds)")
            continue

        extracted.append((ref, image))

    if not extracted:
        return fail("No free asset frames extracted. Check scripts/import_free_assets.py extraction coordinates.")

    category_counts = {category: 0 for category in CATEGORIES}
    for ref, _ in extracted:
        category_counts[ref.category] += 1

    missing_categories = [name for name, count in category_counts.items() if count == 0]
    if missing_categories:
        return fail(f"Missing categories in extraction plan: {', '.join(missing_categories)}")

    atlas, manifest = pack_frames(extracted)
    manifest["source"] = source_meta

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas_path = OUTPUT_DIR / "office.png"
    json_path = OUTPUT_DIR / "office.json"
    atlas.save(atlas_path)
    json_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"[agent-viz] wrote {atlas_path}")
    print(f"[agent-viz] wrote {json_path}")
    print("[agent-viz] category counts:")
    for category in CATEGORIES:
        print(f"  - {category}: {category_counts[category]}")

    if skipped:
        print("[agent-viz] skipped frames:")
        for item in skipped:
            print(f"  - {item}")

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
        print(f"[agent-viz] import failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
