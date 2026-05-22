#!/usr/bin/env python3
"""Generate the No Suggested icon set.

Draws each icon at 4x the target resolution then downsamples with LANCZOS
for crisp small-size results. Output: icons/icon{16,32,48,96,128}.png.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 96, 128)
SUPERSAMPLE = 4

RED = (239, 68, 68, 255)
INK = (31, 41, 55, 255)
PAPER = (255, 255, 255, 255)
SHADOW = (0, 0, 0, 30)


def draw_icon(size: int) -> Image.Image:
    """Render a single icon at `size` x `size` (RGBA, transparent bg)."""
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # --- Background "post card" : white rounded rectangle with a subtle shadow.
    card_margin = int(s * 0.12)
    card_box = (card_margin, card_margin, s - card_margin, s - card_margin)
    card_radius = int(s * 0.18)

    # Soft offset shadow.
    shadow_offset = max(1, int(s * 0.02))
    shadow_box = (
        card_box[0] + shadow_offset,
        card_box[1] + shadow_offset,
        card_box[2] + shadow_offset,
        card_box[3] + shadow_offset,
    )
    draw.rounded_rectangle(shadow_box, radius=card_radius, fill=SHADOW)
    draw.rounded_rectangle(card_box, radius=card_radius, fill=PAPER)

    # --- Three "text" lines inside the card to read as a feed post.
    line_padding_x = int(s * 0.22)
    line_thickness = max(2, int(s * 0.05))
    text_top = int(s * 0.38)
    text_bottom = int(s * 0.72)
    line_count = 3
    spacing = (text_bottom - text_top) // (line_count - 1)
    for i in range(line_count):
        y = text_top + i * spacing
        right_inset = line_padding_x if i < line_count - 1 else line_padding_x + int(s * 0.18)
        draw.rounded_rectangle(
            (line_padding_x, y, s - right_inset, y + line_thickness),
            radius=line_thickness // 2,
            fill=INK,
        )

    # --- Prohibition sign overlay: thick red ring + diagonal bar.
    ring_margin = max(1, int(s * 0.04))
    ring_box = (ring_margin, ring_margin, s - ring_margin, s - ring_margin)
    ring_thickness = max(3, int(s * 0.10))
    draw.ellipse(ring_box, outline=RED, width=ring_thickness)

    # Diagonal bar (upper-left to lower-right, ISO-style).
    bar_thickness = ring_thickness
    cx = s / 2
    cy = s / 2
    radius = (s - 2 * ring_margin) / 2 - ring_thickness / 2
    # Endpoints sit on the inside edge of the ring at 45 degrees.
    angle = math.radians(45)
    dx = math.cos(angle) * radius
    dy = math.sin(angle) * radius
    start = (cx - dx, cy - dy)
    end = (cx + dx, cy + dy)
    draw.line([start, end], fill=RED, width=bar_thickness)

    return img.resize((size, size), Image.LANCZOS)


def main() -> int:
    out_dir = Path(__file__).resolve().parent.parent / "icons"
    out_dir.mkdir(exist_ok=True)
    for size in SIZES:
        path = out_dir / f"icon{size}.png"
        draw_icon(size).save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(out_dir.parent)} ({size}x{size})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
