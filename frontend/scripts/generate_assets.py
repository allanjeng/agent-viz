from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "assets"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

SPRITE_SIZE = 16
SPRITE_COLUMNS = 8
POSES = ["idle", "thinking", "working", "error"]
ARCHETYPES = [
    ("nexus", (42, 157, 143, 255)),
    ("pivot", (231, 111, 81, 255)),
    ("aegis", (38, 70, 83, 255)),
    ("researcher", (138, 177, 125, 255)),
    ("codex", (69, 123, 157, 255)),
    ("claude", (244, 162, 97, 255)),
    ("gemini", (106, 153, 78, 255)),
]


def draw_agent(draw: ImageDraw.ImageDraw, ox: int, oy: int, body: tuple[int, int, int, int], pose: str) -> None:
    outline = (30, 25, 20, 255)
    skin = (238, 204, 170, 255)
    dark = (34, 34, 38, 255)
    chair = (108, 113, 128, 255)

    if pose in {"idle", "thinking", "error"}:
        draw.rectangle((ox + 3, oy + 11, ox + 12, oy + 13), fill=chair)

    torso_top = oy + (5 if pose == "working" else 6)
    torso_bottom = torso_top + 4

    draw.rectangle((ox + 6, oy + 2, ox + 9, oy + 5), fill=skin)
    draw.rectangle((ox + 5, torso_top, ox + 10, torso_bottom), fill=body)

    if pose == "working":
        draw.rectangle((ox + 5, oy + 4, ox + 5, oy + 7), fill=body)
        draw.rectangle((ox + 10, oy + 4, ox + 10, oy + 7), fill=body)
    elif pose == "thinking":
        draw.rectangle((ox + 4, torso_top + 1, ox + 4, torso_top + 3), fill=body)
        draw.rectangle((ox + 11, torso_top + 1, ox + 11, torso_top + 3), fill=body)
        draw.rectangle((ox + 10, torso_bottom + 1, ox + 13, torso_bottom + 1), fill=(198, 210, 219, 255))
    else:
        draw.rectangle((ox + 4, torso_top + 1, ox + 4, torso_top + 3), fill=body)
        draw.rectangle((ox + 11, torso_top + 1, ox + 11, torso_top + 3), fill=body)

    if pose == "working":
        draw.rectangle((ox + 6, torso_bottom + 1, ox + 7, oy + 13), fill=dark)
        draw.rectangle((ox + 8, torso_bottom + 1, ox + 9, oy + 13), fill=dark)
    else:
        draw.rectangle((ox + 6, torso_bottom + 1, ox + 7, oy + 14), fill=dark)
        draw.rectangle((ox + 8, torso_bottom + 1, ox + 9, oy + 14), fill=dark)

    draw.point((ox + 7, oy + 3), fill=(20, 20, 20, 255))
    draw.point((ox + 8, oy + 3), fill=(20, 20, 20, 255))

    if pose == "error":
        draw.point((ox + 12, oy + 2), fill=(240, 60, 55, 255))
        draw.point((ox + 13, oy + 3), fill=(240, 60, 55, 255))

    draw.rectangle((ox + 5, oy + 6, ox + 10, torso_bottom), outline=outline)


def build_agents_sheet() -> None:
    frame_count = len(ARCHETYPES) * len(POSES)
    rows = (frame_count + SPRITE_COLUMNS - 1) // SPRITE_COLUMNS
    width = SPRITE_COLUMNS * SPRITE_SIZE
    height = rows * SPRITE_SIZE

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    frames: dict[str, dict[str, object]] = {}

    index = 0
    for archetype, color in ARCHETYPES:
        for pose in POSES:
            x = (index % SPRITE_COLUMNS) * SPRITE_SIZE
            y = (index // SPRITE_COLUMNS) * SPRITE_SIZE
            draw_agent(draw, x, y, color, pose)

            key = f"{archetype}_{pose}"
            frames[key] = {
                "frame": {"x": x, "y": y, "w": SPRITE_SIZE, "h": SPRITE_SIZE},
                "sourceSize": {"w": SPRITE_SIZE, "h": SPRITE_SIZE},
                "spriteSourceSize": {"x": 0, "y": 0, "w": SPRITE_SIZE, "h": SPRITE_SIZE},
            }
            index += 1

    image.save(ASSET_DIR / "agents.png")

    data = {
        "frames": frames,
        "meta": {
            "image": "agents.png",
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            "scale": "1",
        },
    }

    (ASSET_DIR / "agents.json").write_text(json.dumps(data, indent=2), encoding="utf-8")


def draw_floor(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    base = (184, 201, 188, 255)
    alt = (174, 192, 180, 255)
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=base)

    for y in range(0, size, 4):
        for x in range(0, size, 4):
            if (x + y) % 8 == 0:
                draw.rectangle((ox + x, oy + y, ox + x + 1, oy + y + 1), fill=alt)


def draw_wall(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(120, 141, 131, 255))
    draw.rectangle((ox, oy + size - 7, ox + size - 1, oy + size - 1), fill=(95, 114, 106, 255))


def draw_desk(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(148, 112, 79, 255))
    draw.rectangle((ox + 2, oy + 2, ox + size - 3, oy + size - 3), fill=(167, 126, 90, 255))
    draw.rectangle((ox + 11, oy + 7, ox + 20, oy + 13), fill=(60, 72, 88, 255))
    draw.rectangle((ox + 12, oy + 8, ox + 19, oy + 12), fill=(122, 176, 196, 255))


def draw_chair(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(111, 134, 153, 255))
    draw.rectangle((ox + 8, oy + 8, ox + size - 9, oy + 19), fill=(59, 75, 91, 255))
    draw.rectangle((ox + 11, oy + 20, ox + size - 12, oy + 30), fill=(46, 56, 68, 255))


def draw_rug(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(181, 93, 69, 255))
    draw.rectangle((ox + 2, oy + 2, ox + size - 3, oy + size - 3), outline=(237, 212, 174, 255), width=2)


def draw_door(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(109, 85, 64, 255))
    draw.rectangle((ox + 5, oy + 4, ox + size - 6, oy + size - 5), fill=(128, 99, 74, 255))
    draw.point((ox + size - 10, oy + size // 2), fill=(230, 206, 149, 255))


def build_tiles_sheet() -> None:
    tile_size = 32
    names = ["floor", "wall", "desk", "chair", "rug", "door"]
    columns = 3
    rows = 2

    image = Image.new("RGBA", (columns * tile_size, rows * tile_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    painters = {
        "floor": draw_floor,
        "wall": draw_wall,
        "desk": draw_desk,
        "chair": draw_chair,
        "rug": draw_rug,
        "door": draw_door,
    }

    frames: dict[str, dict[str, object]] = {}

    for index, name in enumerate(names):
        x = (index % columns) * tile_size
        y = (index // columns) * tile_size

        painters[name](draw, x, y, tile_size)

        frames[name] = {
            "frame": {"x": x, "y": y, "w": tile_size, "h": tile_size},
            "sourceSize": {"w": tile_size, "h": tile_size},
            "spriteSourceSize": {"x": 0, "y": 0, "w": tile_size, "h": tile_size},
        }

    image.save(ASSET_DIR / "tiles.png")

    data = {
        "frames": frames,
        "meta": {
            "image": "tiles.png",
            "format": "RGBA8888",
            "size": {"w": columns * tile_size, "h": rows * tile_size},
            "scale": "1",
        },
    }

    (ASSET_DIR / "tiles.json").write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> None:
    build_agents_sheet()
    build_tiles_sheet()
    print(f"generated assets in {ASSET_DIR}")


if __name__ == "__main__":
    main()
