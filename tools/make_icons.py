#!/usr/bin/env python3
"""Generate the No Suggested icon set (concept C — slashed middle feed line).

Draws each icon at 4x the target resolution then downsamples with LANCZOS
for crisp small-size results. Output: icons/icon{16,32,48,96,128}.png.

Regenerate concept explorations separately:
  python tools/make_icon_concepts.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 96, 128)
SUPERSAMPLE = 4

RED = (220, 38, 38, 255)
INK = (24, 24, 27, 255)
MUTED = (80, 80, 90, 255)


def draw_icon(size: int) -> Image.Image:
    """Concept C — dark tile, gray feed lines, red middle line struck."""
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    m = int(s * 0.08)
    radius = int(s * 0.18)
    draw.rounded_rectangle((m, m, s - m, s - m), radius=radius, fill=INK)

    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.048))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    ys = [y0, (y0 + y1) // 2, y1]
    for i, y in enumerate(ys):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        color = RED if i == 1 else MUTED
        draw.rounded_rectangle(
            (pad_x, y, s - right, y + thick),
            radius=thick // 2,
            fill=color,
        )

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
