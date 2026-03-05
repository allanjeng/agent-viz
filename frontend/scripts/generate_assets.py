from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "assets"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

Color = tuple[int, int, int, int]

SPRITE_SIZE = 32
SPRITE_COLUMNS = 8
POSES = ["idle", "thinking", "working", "error"]
@dataclass(frozen=True)
class Palette:
    primary: Color
    secondary: Color
    accent: Color
    hair: Color
    chair: Color


ARCHETYPES: list[tuple[str, Palette]] = [
    (
        "nexus",
        Palette(
            primary=(36, 137, 248, 255),
            secondary=(75, 228, 255, 255),
            accent=(192, 252, 255, 255),
            hair=(23, 73, 150, 255),
            chair=(37, 63, 106, 255),
        ),
    ),
    (
        "pivot",
        Palette(
            primary=(48, 146, 84, 255),
            secondary=(204, 164, 67, 255),
            accent=(242, 226, 137, 255),
            hair=(29, 88, 55, 255),
            chair=(43, 81, 60, 255),
        ),
    ),
    (
        "aegis",
        Palette(
            primary=(144, 45, 52, 255),
            secondary=(68, 22, 28, 255),
            accent=(226, 93, 73, 255),
            hair=(30, 18, 22, 255),
            chair=(55, 34, 38, 255),
        ),
    ),
    (
        "researcher",
        Palette(
            primary=(121, 92, 198, 255),
            secondary=(240, 244, 255, 255),
            accent=(181, 148, 246, 255),
            hair=(74, 50, 126, 255),
            chair=(63, 57, 94, 255),
        ),
    ),
    (
        "codex",
        Palette(
            primary=(231, 135, 54, 255),
            secondary=(247, 184, 95, 255),
            accent=(255, 225, 160, 255),
            hair=(130, 80, 48, 255),
            chair=(88, 64, 44, 255),
        ),
    ),
    (
        "claude",
        Palette(
            primary=(236, 124, 112, 255),
            secondary=(248, 170, 148, 255),
            accent=(255, 219, 204, 255),
            hair=(146, 84, 74, 255),
            chair=(96, 67, 66, 255),
        ),
    ),
    (
        "gemini",
        Palette(
            primary=(47, 161, 155, 255),
            secondary=(63, 201, 193, 255),
            accent=(170, 245, 236, 255),
            hair=(32, 94, 100, 255),
            chair=(38, 80, 80, 255),
        ),
    ),
]


def tint(color: Color, amount: float) -> Color:
    amount = max(-1.0, min(1.0, amount))
    if amount >= 0:
        rgb = [int(c + (255 - c) * amount) for c in color[:3]]
    else:
        rgb = [int(c * (1 + amount)) for c in color[:3]]
    return (max(0, min(255, rgb[0])), max(0, min(255, rgb[1])), max(0, min(255, rgb[2])), color[3])


def draw_emblem(draw: ImageDraw.ImageDraw, ox: int, oy: int, archetype: str, palette: Palette) -> None:
    if archetype == "nexus":
        bolt = palette.accent
        draw.rectangle((ox + 15, oy + 17, ox + 16, oy + 18), fill=bolt)
        draw.rectangle((ox + 14, oy + 19, ox + 15, oy + 20), fill=bolt)
        draw.rectangle((ox + 16, oy + 19, ox + 17, oy + 20), fill=tint(bolt, -0.2))
    elif archetype == "pivot":
        gold = palette.secondary
        draw.rectangle((ox + 14, oy + 18, ox + 14, oy + 20), fill=gold)
        draw.rectangle((ox + 15, oy + 17, ox + 15, oy + 20), fill=tint(gold, 0.14))
        draw.rectangle((ox + 16, oy + 16, ox + 16, oy + 20), fill=palette.accent)
    elif archetype == "aegis":
        shield = palette.accent
        draw.rectangle((ox + 14, oy + 17, ox + 17, oy + 20), fill=shield)
        draw.point((ox + 15, oy + 18), fill=tint(shield, -0.4))
        draw.point((ox + 16, oy + 18), fill=tint(shield, -0.4))
    elif archetype == "researcher":
        paper = palette.secondary
        draw.rectangle((ox + 14, oy + 17, ox + 17, oy + 20), fill=paper)
        draw.point((ox + 15, oy + 18), fill=(105, 118, 156, 255))
        draw.point((ox + 16, oy + 19), fill=(105, 118, 156, 255))
    elif archetype == "codex":
        brace = palette.accent
        draw.rectangle((ox + 14, oy + 17, ox + 14, oy + 20), fill=brace)
        draw.rectangle((ox + 17, oy + 17, ox + 17, oy + 20), fill=brace)
        draw.point((ox + 15, oy + 18), fill=tint(brace, -0.3))
        draw.point((ox + 16, oy + 19), fill=tint(brace, -0.3))
    elif archetype == "claude":
        wave = palette.accent
        draw.rectangle((ox + 14, oy + 19, ox + 17, oy + 19), fill=wave)
        draw.point((ox + 15, oy + 18), fill=wave)
        draw.point((ox + 16, oy + 20), fill=tint(wave, -0.15))
    elif archetype == "gemini":
        draw.rectangle((ox + 14, oy + 17, ox + 15, oy + 20), fill=palette.primary)
        draw.rectangle((ox + 16, oy + 17, ox + 17, oy + 20), fill=palette.secondary)
        draw.point((ox + 15, oy + 18), fill=palette.accent)
        draw.point((ox + 16, oy + 19), fill=palette.accent)


def draw_agent(draw: ImageDraw.ImageDraw, ox: int, oy: int, archetype: str, palette: Palette, pose: str) -> None:
    skin: Color = (244, 206, 176, 255)
    skin_shadow = tint(skin, -0.1)
    pants = tint(palette.primary, -0.52)
    arm = tint(palette.primary, -0.06)
    desk_base: Color = (90, 97, 112, 255)
    desk_top = tint(desk_base, 0.2)
    monitor_frame: Color = (31, 35, 45, 255)
    monitor_frame_hi = tint(monitor_frame, 0.2)
    keyboard: Color = (64, 70, 84, 255)
    chair_hi = tint(palette.chair, 0.16)

    if pose == "working":
        screen = tint(palette.accent, 0.05)
    elif pose == "error":
        screen = (232, 79, 66, 255)
    elif pose == "thinking":
        screen = tint(palette.secondary, 0.18)
    else:
        screen = tint(palette.secondary, -0.08)

    draw.rectangle((ox + 6, oy, ox + 25, oy + 6), fill=desk_base)
    draw.rectangle((ox + 7, oy + 1, ox + 24, oy + 2), fill=desk_top)
    draw.rectangle((ox + 10, oy + 1, ox + 21, oy + 7), fill=monitor_frame)
    draw.rectangle((ox + 11, oy + 2, ox + 20, oy + 6), fill=screen)
    draw.rectangle((ox + 11, oy + 8, ox + 20, oy + 9), fill=keyboard)

    if pose == "working":
        draw.rectangle((ox + 13, oy + 8, ox + 18, oy + 8), fill=tint(palette.accent, 0.1))
        draw.point((ox + 12, oy + 3), fill=tint(screen, 0.22))
        draw.point((ox + 19, oy + 3), fill=tint(screen, 0.22))
    elif pose == "thinking":
        bubble = (240, 244, 255, 255)
        draw.point((ox + 23, oy + 12), fill=bubble)
        draw.rectangle((ox + 24, oy + 10, ox + 26, oy + 12), fill=bubble)
        draw.point((ox + 25, oy + 9), fill=bubble)
    elif pose == "error":
        warn = (243, 85, 73, 255)
        draw.rectangle((ox + 23, oy + 10, ox + 25, oy + 12), fill=warn)
        draw.point((ox + 24, oy + 11), fill=(255, 237, 219, 255))

    draw.rectangle((ox + 9, oy + 18, ox + 22, oy + 30), fill=palette.chair)
    draw.rectangle((ox + 10, oy + 15, ox + 21, oy + 20), fill=chair_hi)

    draw.rectangle((ox + 12, oy + 10, ox + 19, oy + 15), fill=skin)
    draw.rectangle((ox + 12, oy + 10, ox + 19, oy + 12), fill=palette.hair)
    draw.point((ox + 14, oy + 13), fill=(28, 24, 22, 255))
    draw.point((ox + 17, oy + 13), fill=(28, 24, 22, 255))
    draw.rectangle((ox + 14, oy + 15, ox + 17, oy + 15), fill=skin_shadow)

    torso_top = 16 if pose != "working" else 15
    torso_bottom = 22

    if archetype == "gemini":
        draw.rectangle((ox + 10, oy + torso_top, ox + 15, oy + torso_bottom), fill=palette.primary)
        draw.rectangle((ox + 16, oy + torso_top, ox + 21, oy + torso_bottom), fill=palette.secondary)
    else:
        draw.rectangle((ox + 10, oy + torso_top, ox + 21, oy + torso_bottom), fill=palette.primary)
        draw.rectangle((ox + 11, oy + torso_top + 2, ox + 20, oy + torso_top + 3), fill=palette.secondary)

    if pose == "working":
        draw.rectangle((ox + 8, oy + 14, ox + 11, oy + 18), fill=arm)
        draw.rectangle((ox + 20, oy + 14, ox + 23, oy + 18), fill=arm)
        draw.rectangle((ox + 10, oy + 13, ox + 11, oy + 14), fill=skin)
        draw.rectangle((ox + 20, oy + 13, ox + 21, oy + 14), fill=skin)
    elif pose == "thinking":
        draw.rectangle((ox + 8, oy + 17, ox + 11, oy + 20), fill=arm)
        draw.rectangle((ox + 20, oy + 14, ox + 22, oy + 18), fill=arm)
        draw.rectangle((ox + 19, oy + 13, ox + 20, oy + 14), fill=skin)
    elif pose == "error":
        draw.rectangle((ox + 8, oy + 18, ox + 11, oy + 22), fill=arm)
        draw.rectangle((ox + 20, oy + 16, ox + 22, oy + 20), fill=arm)
        draw.rectangle((ox + 21, oy + 21, ox + 22, oy + 22), fill=skin_shadow)
    else:
        draw.rectangle((ox + 8, oy + 17, ox + 11, oy + 20), fill=arm)
        draw.rectangle((ox + 20, oy + 17, ox + 23, oy + 20), fill=arm)

    leg_top = 23 if pose != "working" else 22
    draw.rectangle((ox + 12, oy + leg_top, ox + 14, oy + 28), fill=pants)
    draw.rectangle((ox + 17, oy + leg_top, ox + 19, oy + 28), fill=pants)
    draw.rectangle((ox + 12, oy + 29, ox + 14, oy + 30), fill=tint(pants, -0.12))
    draw.rectangle((ox + 17, oy + 29, ox + 19, oy + 30), fill=tint(pants, -0.12))

    draw.rectangle((ox + 10, oy + 23, ox + 21, oy + 23), fill=tint(palette.primary, -0.18))
    draw_emblem(draw, ox, oy, archetype, palette)

    draw.rectangle((ox + 10, oy + torso_top, ox + 21, oy + torso_bottom), outline=tint(palette.primary, -0.46))
    draw.rectangle((ox + 12, oy + 10, ox + 19, oy + 15), outline=tint(palette.hair, -0.2))
    draw.rectangle((ox + 10, oy + 1, ox + 21, oy + 7), outline=monitor_frame_hi)


def build_agents_sheet() -> None:
    frame_count = len(ARCHETYPES) * len(POSES)
    rows = (frame_count + SPRITE_COLUMNS - 1) // SPRITE_COLUMNS
    width = SPRITE_COLUMNS * SPRITE_SIZE
    height = rows * SPRITE_SIZE

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    frames: dict[str, dict[str, object]] = {}

    index = 0
    for archetype, palette in ARCHETYPES:
        for pose in POSES:
            x = (index % SPRITE_COLUMNS) * SPRITE_SIZE
            y = (index // SPRITE_COLUMNS) * SPRITE_SIZE
            draw_agent(draw, x, y, archetype, palette, pose)

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
