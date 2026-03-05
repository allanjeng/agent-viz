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
POSES = ("idle", "thinking", "working", "error")


@dataclass(frozen=True)
class CharacterDesign:
    primary: Color
    secondary: Color
    accent: Color
    shadow: Color
    skin: Color


ARCHETYPES: dict[str, CharacterDesign] = {
    "nexus": CharacterDesign(
        primary=(39, 81, 170, 255),
        secondary=(19, 39, 86, 255),
        accent=(88, 166, 255, 255),
        shadow=(11, 20, 38, 255),
        skin=(218, 188, 164, 255),
    ),
    "pivot": CharacterDesign(
        primary=(63, 130, 84, 255),
        secondary=(210, 166, 74, 255),
        accent=(253, 224, 141, 255),
        shadow=(22, 42, 28, 255),
        skin=(229, 196, 165, 255),
    ),
    "aegis": CharacterDesign(
        primary=(110, 35, 42, 255),
        secondary=(57, 20, 25, 255),
        accent=(248, 81, 73, 255),
        shadow=(20, 10, 13, 255),
        skin=(212, 180, 159, 255),
    ),
    "researcher": CharacterDesign(
        primary=(191, 140, 255, 255),
        secondary=(225, 231, 246, 255),
        accent=(169, 117, 250, 255),
        shadow=(42, 30, 68, 255),
        skin=(229, 199, 176, 255),
    ),
    "codex": CharacterDesign(
        primary=(198, 129, 45, 255),
        secondary=(210, 102, 44, 255),
        accent=(255, 187, 86, 255),
        shadow=(62, 39, 20, 255),
        skin=(234, 201, 168, 255),
    ),
    "claude": CharacterDesign(
        primary=(222, 112, 114, 255),
        secondary=(245, 163, 146, 255),
        accent=(255, 197, 186, 255),
        shadow=(70, 35, 39, 255),
        skin=(236, 202, 180, 255),
    ),
    "gemini": CharacterDesign(
        primary=(62, 173, 158, 255),
        secondary=(75, 126, 198, 255),
        accent=(164, 241, 226, 255),
        shadow=(22, 44, 57, 255),
        skin=(226, 196, 172, 255),
    ),
}


def tint(color: Color, amount: float) -> Color:
    amount = max(-1.0, min(1.0, amount))
    if amount >= 0:
        rgb = [int(c + (255 - c) * amount) for c in color[:3]]
    else:
        rgb = [int(c * (1 + amount)) for c in color[:3]]
    return (
        max(0, min(255, rgb[0])),
        max(0, min(255, rgb[1])),
        max(0, min(255, rgb[2])),
        color[3],
    )


def draw_character_frame(
    draw: ImageDraw.ImageDraw,
    ox: int,
    oy: int,
    archetype: str,
    design: CharacterDesign,
    pose: str,
) -> None:
    def r(x1: int, y1: int, x2: int, y2: int, fill: Color, *, outline: Color | None = None) -> None:
        draw.rectangle((ox + x1, oy + y1, ox + x2, oy + y2), fill=fill, outline=outline)

    def p(x: int, y: int, fill: Color) -> None:
        draw.point((ox + x, oy + y), fill=fill)

    chair = tint(design.shadow, 0.5)
    chair_hi = tint(chair, 0.22)
    keyboard_base: Color = (38, 46, 62, 255)

    # Shadow and chair
    r(9, 30, 22, 30, tint(design.shadow, 0.25))
    r(9, 18, 22, 30, chair)
    r(10, 15, 21, 20, chair_hi)

    # Keyboard plane and activity lights
    r(10, 24, 21, 25, keyboard_base)
    if pose == "working":
        r(11, 24, 20, 24, tint(design.accent, 0.1))
        p(12, 25, design.accent)
        p(15, 25, tint(design.accent, 0.2))
        p(18, 25, design.accent)

    # Legs
    leg = tint(design.primary, -0.35)
    r(12, 23, 14, 29, leg)
    r(17, 23, 19, 29, leg)

    # Base torso
    if archetype == "gemini":
        r(10, 16, 15, 23, design.primary)
        r(16, 16, 21, 23, design.secondary)
        r(15, 16, 16, 23, tint(design.accent, -0.2))
    elif archetype == "researcher":
        coat = tint(design.secondary, 0.05)
        r(10, 16, 21, 23, coat)
        r(15, 16, 16, 23, tint(design.accent, -0.2))
        p(14, 19, tint(design.accent, 0.15))
        p(17, 19, tint(design.accent, 0.15))
    elif archetype == "aegis":
        armor = tint(design.primary, 0.12)
        r(9, 16, 22, 23, armor)
        r(11, 17, 20, 22, tint(design.secondary, -0.1))
        r(9, 17, 10, 18, design.accent)
        r(21, 17, 22, 18, design.accent)
    elif archetype == "pivot":
        r(10, 16, 21, 23, design.primary)
        r(11, 16, 20, 20, tint(design.primary, 0.15))
        r(15, 16, 16, 23, design.secondary)
        p(15, 21, tint(design.secondary, 0.2))
    elif archetype == "codex":
        vest = tint(design.secondary, 0.08)
        r(10, 16, 21, 23, vest)
        r(12, 16, 13, 23, tint(design.accent, 0.1))
        r(18, 16, 19, 23, tint(design.accent, 0.1))
    else:
        r(10, 16, 21, 23, design.primary)
        r(11, 17, 20, 19, tint(design.secondary, -0.15))

    # Arms by pose
    arm = tint(design.primary, 0.1)
    hand = tint(design.skin, -0.06)
    if pose == "working":
        r(8, 18, 11, 22, arm)
        r(20, 18, 23, 22, arm)
        r(10, 22, 11, 23, hand)
        r(20, 22, 21, 23, hand)
    elif pose == "thinking":
        r(8, 19, 11, 23, arm)
        r(20, 15, 22, 19, arm)
        r(19, 14, 20, 15, hand)
    elif pose == "error":
        r(8, 15, 11, 19, arm)
        r(20, 15, 23, 19, arm)
        r(8, 14, 9, 15, hand)
        r(22, 14, 23, 15, hand)
    else:
        r(8, 19, 11, 22, arm)
        r(20, 19, 23, 22, arm)

    # Head / helmet / hood
    if archetype == "aegis":
        helm = tint(design.secondary, 0.02)
        r(11, 8, 20, 15, helm)
        r(10, 10, 21, 15, tint(helm, -0.06))
        r(12, 11, 19, 12, design.accent)
    elif archetype == "nexus":
        hood = tint(design.secondary, -0.05)
        r(10, 7, 21, 15, hood)
        r(12, 10, 19, 15, design.skin)
        p(14, 12, design.accent)
        p(17, 12, design.accent)
    else:
        r(12, 9, 19, 15, design.skin)
        hair = tint(design.shadow, 0.45)
        r(12, 9, 19, 11, hair)
        p(14, 12, (22, 24, 29, 255))
        p(17, 12, (22, 24, 29, 255))

    # Character-specific accessories
    if archetype == "pivot":
        g = tint(design.shadow, -0.15)
        r(13, 12, 14, 13, g)
        r(17, 12, 18, 13, g)
        p(15, 12, g)
        p(16, 12, g)
        r(15, 13, 16, 13, tint(design.secondary, 0.1))
    elif archetype == "researcher":
        # Magnifier in thinking, notebook otherwise
        if pose == "thinking":
            glass = tint(design.accent, 0.2)
            r(22, 13, 24, 15, glass)
            p(23, 16, tint(design.shadow, 0.5))
            p(24, 17, tint(design.shadow, 0.5))
        else:
            r(22, 19, 24, 22, tint(design.secondary, 0.08), outline=tint(design.accent, -0.2))
            p(23, 20, tint(design.accent, -0.25))
    elif archetype == "codex":
        helmet = tint(design.accent, 0.05)
        r(11, 7, 20, 10, helmet)
        r(12, 10, 19, 10, tint(helmet, -0.1))
    elif archetype == "claude":
        headset = tint(design.accent, -0.1)
        p(11, 11, headset)
        p(20, 11, headset)
        r(11, 10, 12, 12, headset)
        r(19, 10, 20, 12, headset)
        r(12, 9, 19, 9, tint(headset, -0.1))
    elif archetype == "gemini":
        p(15, 13, tint(design.accent, 0.2))
        p(16, 13, tint(design.accent, 0.2))
    elif archetype == "nexus":
        bolt = tint(design.accent, 0.15)
        p(21, 18, bolt)
        p(22, 17, bolt)
        p(22, 19, tint(bolt, -0.15))
    elif archetype == "aegis":
        shield = tint(design.accent, -0.1)
        r(22, 18, 24, 21, shield)
        p(23, 19, tint(shield, 0.2))

    # Pose effects
    if pose == "thinking":
        bubble = (220, 231, 245, 255)
        p(23, 9, bubble)
        p(24, 8, bubble)
        r(25, 6, 27, 8, bubble)
        p(26, 5, bubble)
    elif pose == "error":
        spark = (248, 81, 73, 255)
        p(7, 11, spark)
        p(8, 10, spark)
        p(24, 10, spark)
        p(25, 11, spark)
        p(15, 5, spark)
        r(10, 7, 21, 24, (248, 81, 73, 60), outline=tint(spark, -0.2))

    # Frame outline to keep crisp silhouette
    r(10, 16, 21, 23, (0, 0, 0, 0), outline=tint(design.shadow, -0.1))


def build_agents_sheet() -> None:
    entries = [(name, ARCHETYPES[name]) for name in ARCHETYPES]
    frame_count = len(entries) * len(POSES)
    rows = (frame_count + SPRITE_COLUMNS - 1) // SPRITE_COLUMNS

    width = SPRITE_COLUMNS * SPRITE_SIZE
    height = rows * SPRITE_SIZE

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    frames: dict[str, dict[str, object]] = {}

    index = 0
    for archetype, design in entries:
        for pose in POSES:
            x = (index % SPRITE_COLUMNS) * SPRITE_SIZE
            y = (index // SPRITE_COLUMNS) * SPRITE_SIZE
            draw_character_frame(draw, x, y, archetype, design, pose)

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


def draw_floor_dark(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    base = (13, 17, 23, 255)
    alt = (18, 25, 34, 255)
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=base)
    for y in range(0, size, 4):
        for x in range(0, size, 4):
            if (x + y) % 8 == 0:
                draw.rectangle((ox + x, oy + y, ox + x + 1, oy + y + 1), fill=alt)


def draw_floor_alt(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    base = (16, 27, 38, 255)
    stripe = (22, 36, 50, 255)
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=base)
    for y in range(0, size, 6):
        draw.rectangle((ox, oy + y, ox + size - 1, oy + y), fill=stripe)


def draw_floor_grid(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    base = (10, 16, 25, 255)
    line = (41, 72, 109, 255)
    glow = (88, 166, 255, 255)
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=base)
    for x in range(0, size, 8):
        draw.rectangle((ox + x, oy, ox + x, oy + size - 1), fill=line)
    for y in range(0, size, 8):
        draw.rectangle((ox, oy + y, ox + size - 1, oy + y), fill=line)
    draw.point((ox + size // 2, oy + size // 2), fill=glow)


def draw_wall_dark(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(21, 27, 36, 255))
    draw.rectangle((ox + 1, oy + 1, ox + size - 2, oy + size - 8), fill=(28, 36, 48, 255))
    draw.rectangle((ox, oy + size - 7, ox + size - 1, oy + size - 1), fill=(11, 16, 22, 255))


def draw_wall_neon(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_wall_dark(draw, ox, oy, size)
    draw.rectangle((ox + 3, oy + 5, ox + size - 4, oy + 7), fill=(88, 166, 255, 255))
    draw.rectangle((ox + 3, oy + 8, ox + size - 4, oy + 8), fill=(188, 220, 255, 255))


def draw_zone(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int, base: Color, edge: Color, glow: Color) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=base)
    draw.rectangle((ox + 1, oy + 1, ox + size - 2, oy + size - 2), outline=edge)
    draw.rectangle((ox + 4, oy + 4, ox + size - 5, oy + size - 5), outline=glow)


def draw_zone_nexus(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_zone(draw, ox, oy, size, (13, 28, 47, 255), (37, 79, 130, 255), (88, 166, 255, 255))


def draw_zone_pivot(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_zone(draw, ox, oy, size, (20, 34, 22, 255), (44, 97, 61, 255), (210, 166, 74, 255))


def draw_zone_aegis(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_zone(draw, ox, oy, size, (41, 18, 25, 255), (88, 33, 42, 255), (248, 81, 73, 255))


def draw_zone_researcher(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_zone(draw, ox, oy, size, (33, 23, 55, 255), (73, 53, 116, 255), (188, 140, 255, 255))


def draw_zone_contract(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_zone(draw, ox, oy, size, (26, 26, 30, 255), (59, 66, 75, 255), (210, 153, 34, 255))


def draw_desk(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int, body: Color, top: Color) -> None:
    draw.rectangle((ox, oy + 6, ox + size - 1, oy + size - 1), fill=body)
    draw.rectangle((ox + 2, oy + 8, ox + size - 3, oy + size - 3), fill=top)


def draw_desk_nexus(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_desk(draw, ox, oy, size, (30, 43, 66, 255), (39, 58, 88, 255))
    for x in (6, 13, 20):
        draw.rectangle((ox + x, oy + 10, ox + x + 4, oy + 15), fill=(18, 27, 39, 255))
        draw.rectangle((ox + x + 1, oy + 11, ox + x + 3, oy + 14), fill=(88, 166, 255, 255))


def draw_desk_pivot(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_desk(draw, ox, oy, size, (33, 49, 37, 255), (49, 70, 55, 255))
    draw.rectangle((ox + 9, oy + 10, ox + 22, oy + 15), fill=(22, 33, 26, 255))
    draw.line((ox + 10, oy + 14, ox + 13, oy + 12, ox + 16, oy + 13, ox + 20, oy + 10), fill=(63, 185, 80, 255), width=1)
    draw.point((ox + 20, oy + 10), fill=(210, 166, 74, 255))


def draw_desk_aegis(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_desk(draw, ox, oy, size, (52, 27, 31, 255), (70, 35, 41, 255))
    draw.rectangle((ox + 11, oy + 10, ox + 20, oy + 16), fill=(32, 15, 18, 255))
    draw.rectangle((ox + 13, oy + 11, ox + 18, oy + 15), fill=(248, 81, 73, 255))
    draw.point((ox + 15, oy + 13), fill=(255, 210, 210, 255))


def draw_desk_researcher(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_desk(draw, ox, oy, size, (55, 43, 78, 255), (72, 57, 100, 255))
    for idx, color in enumerate(((178, 139, 238, 255), (149, 112, 218, 255), (111, 84, 169, 255))):
        draw.rectangle((ox + 8 + idx * 4, oy + 10, ox + 10 + idx * 4, oy + 16), fill=color)
    draw.rectangle((ox + 20, oy + 11, ox + 23, oy + 15), fill=(217, 223, 239, 255))


def draw_desk_contract(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_desk(draw, ox, oy, size, (46, 46, 52, 255), (66, 66, 74, 255))
    draw.rectangle((ox + 10, oy + 11, ox + 21, oy + 15), fill=(25, 30, 38, 255))
    draw.rectangle((ox + 11, oy + 12, ox + 20, oy + 14), fill=(210, 153, 34, 255))


def draw_chair(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int, main: Color, accent: Color) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=main)
    draw.rectangle((ox + 8, oy + 7, ox + size - 9, oy + 19), fill=accent)
    draw.rectangle((ox + 10, oy + 20, ox + size - 11, oy + 30), fill=tint(accent, -0.2))


def draw_chair_nexus(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_chair(draw, ox, oy, size, (20, 34, 52, 255), (46, 82, 127, 255))


def draw_chair_pivot(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_chair(draw, ox, oy, size, (26, 42, 30, 255), (53, 86, 61, 255))


def draw_chair_aegis(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_chair(draw, ox, oy, size, (42, 20, 25, 255), (79, 32, 40, 255))


def draw_chair_researcher(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_chair(draw, ox, oy, size, (37, 29, 58, 255), (74, 57, 110, 255))


def draw_chair_contract(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw_chair(draw, ox, oy, size, (34, 34, 41, 255), (63, 63, 74, 255))


def draw_prop_monitor_stack(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(15, 25, 37, 255))
    for x in (4, 12, 20):
        draw.rectangle((ox + x, oy + 8, ox + x + 6, oy + 16), fill=(22, 34, 47, 255))
        draw.rectangle((ox + x + 1, oy + 9, ox + x + 5, oy + 15), fill=(88, 166, 255, 255))


def draw_prop_chart_board(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(24, 35, 22, 255))
    draw.rectangle((ox + 5, oy + 6, ox + size - 6, oy + size - 6), fill=(17, 28, 19, 255))
    draw.line((ox + 8, oy + 22, ox + 11, oy + 18, ox + 15, oy + 19, ox + 18, oy + 13, ox + 22, oy + 11), fill=(63, 185, 80, 255), width=1)
    draw.point((ox + 22, oy + 11), fill=(210, 166, 74, 255))


def draw_prop_shield_node(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(39, 16, 21, 255))
    draw.rectangle((ox + 10, oy + 8, ox + 21, oy + 21), fill=(57, 22, 29, 255))
    draw.rectangle((ox + 12, oy + 10, ox + 19, oy + 18), fill=(248, 81, 73, 255))
    draw.point((ox + 15, oy + 13), fill=(255, 224, 224, 255))


def draw_prop_book_stack(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(31, 23, 48, 255))
    books = [
        ((8, 8, 23, 10), (171, 126, 235, 255)),
        ((6, 12, 21, 14), (118, 90, 177, 255)),
        ((10, 16, 25, 18), (216, 225, 238, 255)),
        ((7, 20, 22, 22), (149, 112, 218, 255)),
    ]
    for (x1, y1, x2, y2), color in books:
        draw.rectangle((ox + x1, oy + y1, ox + x2, oy + y2), fill=color)


def draw_prop_server_rack(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(19, 24, 30, 255))
    draw.rectangle((ox + 9, oy + 4, ox + 22, oy + 27), fill=(33, 43, 56, 255))
    for y in range(7, 25, 4):
        draw.rectangle((ox + 11, oy + y, ox + 20, oy + y + 1), fill=(63, 95, 134, 255))
    draw.point((ox + 19, oy + 7), fill=(248, 81, 73, 255))
    draw.point((ox + 19, oy + 11), fill=(63, 185, 80, 255))


def draw_prop_temp_terminal(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(24, 24, 28, 255))
    draw.rectangle((ox + 9, oy + 9, ox + 22, oy + 18), fill=(20, 26, 33, 255))
    draw.rectangle((ox + 10, oy + 10, ox + 21, oy + 17), fill=(210, 153, 34, 255))
    draw.rectangle((ox + 12, oy + 20, ox + 19, oy + 22), fill=(71, 71, 79, 255))


def draw_door(draw: ImageDraw.ImageDraw, ox: int, oy: int, size: int) -> None:
    draw.rectangle((ox, oy, ox + size - 1, oy + size - 1), fill=(36, 42, 51, 255))
    draw.rectangle((ox + 4, oy + 3, ox + size - 5, oy + size - 4), fill=(49, 57, 69, 255))
    draw.rectangle((ox + 7, oy + 6, ox + size - 8, oy + 8), fill=(88, 166, 255, 255))
    draw.point((ox + size - 10, oy + size // 2), fill=(210, 153, 34, 255))


def build_tiles_sheet() -> None:
    tile_size = 32

    names = [
        "floor_dark",
        "floor_alt",
        "floor_grid",
        "wall_dark",
        "wall_neon",
        "zone_nexus",
        "zone_pivot",
        "zone_aegis",
        "zone_researcher",
        "zone_contract",
        "desk_nexus",
        "desk_pivot",
        "desk_aegis",
        "desk_researcher",
        "desk_contract",
        "chair_nexus",
        "chair_pivot",
        "chair_aegis",
        "chair_researcher",
        "chair_contract",
        "prop_monitor_stack",
        "prop_chart_board",
        "prop_shield_node",
        "prop_book_stack",
        "prop_server_rack",
        "prop_temp_terminal",
        "door",
    ]

    painters = {
        "floor_dark": draw_floor_dark,
        "floor_alt": draw_floor_alt,
        "floor_grid": draw_floor_grid,
        "wall_dark": draw_wall_dark,
        "wall_neon": draw_wall_neon,
        "zone_nexus": draw_zone_nexus,
        "zone_pivot": draw_zone_pivot,
        "zone_aegis": draw_zone_aegis,
        "zone_researcher": draw_zone_researcher,
        "zone_contract": draw_zone_contract,
        "desk_nexus": draw_desk_nexus,
        "desk_pivot": draw_desk_pivot,
        "desk_aegis": draw_desk_aegis,
        "desk_researcher": draw_desk_researcher,
        "desk_contract": draw_desk_contract,
        "chair_nexus": draw_chair_nexus,
        "chair_pivot": draw_chair_pivot,
        "chair_aegis": draw_chair_aegis,
        "chair_researcher": draw_chair_researcher,
        "chair_contract": draw_chair_contract,
        "prop_monitor_stack": draw_prop_monitor_stack,
        "prop_chart_board": draw_prop_chart_board,
        "prop_shield_node": draw_prop_shield_node,
        "prop_book_stack": draw_prop_book_stack,
        "prop_server_rack": draw_prop_server_rack,
        "prop_temp_terminal": draw_prop_temp_terminal,
        "door": draw_door,
    }

    columns = 6
    rows = (len(names) + columns - 1) // columns

    image = Image.new("RGBA", (columns * tile_size, rows * tile_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

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
