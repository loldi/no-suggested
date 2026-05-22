#!/usr/bin/env python3
"""Generate toolbar icon concept variants for design review.

Outputs PNGs to concepts/icons/ at 128px (preview) and 32px (toolbar size).
Run: python tools/make_icon_concepts.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont

SUPERSAMPLE = 4
PREVIEW = 128
TOOLBAR = 32

# Palette aligned with popup E1 (zinc + red)
RED = (220, 38, 38, 255)
RED_SOFT = (248, 113, 113, 255)
INK = (24, 24, 27, 255)
ZINC = (39, 39, 42, 255)
ZINC_LIGHT = (63, 63, 70, 255)
PAPER = (250, 250, 250, 255)
MUTED = (161, 161, 170, 255)
WHITE = (255, 255, 255, 255)


def canvas(size: int) -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img), s


def down(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def rounded_rect(draw, box, radius, fill, outline=None, width=0):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def feed_lines(draw, s, *, pad_x_ratio=0.22, y0_ratio=0.36, y1_ratio=0.70, fill=INK, radius=None):
    pad_x = int(s * pad_x_ratio)
    thick = max(2, int(s * 0.045))
    if radius is None:
        radius = thick // 2
    y0, y1 = int(s * y0_ratio), int(s * y1_ratio)
    for i, y in enumerate([y0, (y0 + y1) // 2, y1]):
        right = pad_x if i < 2 else pad_x + int(s * 0.16)
        rounded_rect(draw, (pad_x, y, s - right, y + thick), radius, fill)


def slash(draw, s, *, color=RED, width_ratio=0.09, angle=45, inset_ratio=0.08):
    w = max(3, int(s * width_ratio))
    inset = int(s * inset_ratio)
    cx = cy = s / 2
    r = (s / 2 - inset) * 0.92
    rad = math.radians(angle)
    dx, dy = math.cos(rad) * r, math.sin(rad) * r
    draw.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=color, width=w)


def circle_slash(draw, s, *, ring_color=RED, inset_ratio=0.06, ring_ratio=0.09):
    inset = int(s * inset_ratio)
    ring = max(3, int(s * ring_ratio))
    draw.ellipse((inset, inset, s - inset, s - inset), outline=ring_color, width=ring)
    slash(draw, s, color=ring_color, width_ratio=ring_ratio)


# ─── Variants ───────────────────────────────────────────────────────────────

def icon_a_current(size: int) -> Image.Image:
    """A — Current: white post card + prohibition overlay."""
    img, draw, s = canvas(size)
    m = int(s * 0.10)
    r = int(s * 0.20)
    rounded_rect(draw, (m, m, s - m, s - m), r, PAPER)
    feed_lines(draw, s, fill=(31, 41, 55, 255))
    circle_slash(draw, s)
    return down(img, size)


def icon_b_dark_slash(size: int) -> Image.Image:
    """B — Dark tile, slash only. No circle. Best legibility at 16px."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    r = int(s * 0.22)
    rounded_rect(draw, (m, m, s - m, s - m), r, ZINC)
    feed_lines(draw, s, fill=MUTED)
    slash(draw, s, color=RED, width_ratio=0.11)
    return down(img, size)


def icon_b_rounded(size: int) -> Image.Image:
    """B′ — B with softer corners + pill lines (matches rounded popup)."""
    img, draw, s = canvas(size)
    m = int(s * 0.06)
    r = int(s * 0.28)
    rounded_rect(draw, (m, m, s - m, s - m), r, ZINC)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.05))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    for i, y in enumerate([y0, (y0 + y1) // 2, y1]):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        rounded_rect(draw, (pad_x, y, s - right, y + thick), thick, fill=MUTED)
    slash(draw, s, color=RED_SOFT, width_ratio=0.10)
    return down(img, size)


def dotted_hline(draw, x0: float, x1: float, y: float, thickness: int, color, *, gap_ratio: float = 0.55):
    """Horizontal dashed line from x0 to x1 at baseline y."""
    dash = max(2, int(thickness * 2.0))
    gap = max(1, int(dash * gap_ratio))
    x = x0
    r = max(1, thickness // 2)
    while x < x1:
        x_end = min(x + dash, x1)
        if x_end - x >= 1:
            rounded_rect(draw, (x, y, x_end, y + thickness), r, color)
        x += dash + gap


def icon_c_slashed_feed(size: int) -> Image.Image:
    """C — Middle feed line struck through in red. No prohibition symbol."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    rounded_rect(draw, (m, m, s - m, s - m), int(s * 0.18), INK)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.048))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    ys = [y0, (y0 + y1) // 2, y1]
    for i, y in enumerate(ys):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        color = RED if i == 1 else (80, 80, 90, 255)
        rounded_rect(draw, (pad_x, y, s - right, y + thick), thick // 2, color)
    return down(img, size)


def icon_c_dotted_feed(size: int) -> Image.Image:
    """C′ — Middle feed line as dotted red. Softer 'filtered out' read."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    rounded_rect(draw, (m, m, s - m, s - m), int(s * 0.18), INK)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.048))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    ys = [y0, (y0 + y1) // 2, y1]
    for i, y in enumerate(ys):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        if i == 1:
            dotted_hline(draw, pad_x, s - right, y, thick, RED)
        else:
            rounded_rect(draw, (pad_x, y, s - right, y + thick), thick // 2, (80, 80, 90, 255))
    return down(img, size)


def icon_c_with_slash(size: int) -> Image.Image:
    """C + slash — C's dark feed tile, all lines muted, diagonal red slash overlay."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    rounded_rect(draw, (m, m, s - m, s - m), int(s * 0.18), INK)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.048))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    ys = [y0, (y0 + y1) // 2, y1]
    for i, y in enumerate(ys):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        rounded_rect(draw, (pad_x, y, s - right, y + thick), thick // 2, (80, 80, 90, 255))
    slash(draw, s, color=RED, width_ratio=0.10)
    return down(img, size)


def icon_c_with_circle_slash(size: int) -> Image.Image:
    """C + circle-slash — C's dark feed tile with full prohibition overlay."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    rounded_rect(draw, (m, m, s - m, s - m), int(s * 0.18), INK)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.048))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    ys = [y0, (y0 + y1) // 2, y1]
    for i, y in enumerate(ys):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        rounded_rect(draw, (pad_x, y, s - right, y + thick), thick // 2, (80, 80, 90, 255))
    circle_slash(draw, s, ring_color=RED, inset_ratio=0.05, ring_ratio=0.085)
    return down(img, size)


def icon_d_monogram(size: int) -> Image.Image:
    """D — NS monogram stamp. Extension badge energy, not literal."""
    img, draw, s = canvas(size)
    m = int(s * 0.10)
    rounded_rect(draw, (m, m, s - m, s - m), int(s * 0.16), ZINC)
    # Red accent corner tick
    tick = int(s * 0.14)
    draw.polygon([(s - m, m), (s - m - tick, m), (s - m, m + tick)], fill=RED)
    try:
        font_size = int(s * 0.34)
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    text = "NS"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((s - tw) / 2, (s - th) / 2 - s * 0.02), text, fill=WHITE, font=font)
    return down(img, size)


def icon_e_circle_only(size: int) -> Image.Image:
    """E — Prohibition mark on transparent. Nothing else."""
    img, draw, s = canvas(size)
    circle_slash(draw, s, ring_color=RED, inset_ratio=0.04, ring_ratio=0.10)
    return down(img, size)


def icon_f_outlined_card(size: int) -> Image.Image:
    """F — Outlined post card + corner block badge."""
    img, draw, s = canvas(size)
    m = int(s * 0.14)
    r = int(s * 0.14)
    rounded_rect(draw, (m, m, s - m, s - m), r, (0, 0, 0, 0), outline=MUTED, width=max(2, int(s * 0.04)))
    feed_lines(draw, s, pad_x_ratio=0.24, fill=MUTED)
    # Corner badge
    bs = int(s * 0.28)
    rounded_rect(draw, (s - m - bs + int(s * 0.04), m - int(s * 0.04), s - m + int(s * 0.04), m + bs), int(s * 0.08), RED)
    slash(draw, s, color=WHITE, width_ratio=0.06, inset_ratio=0.58)
    return down(img, size)


def icon_g_accent_bar(size: int) -> Image.Image:
    """G — E1 popup DNA: left red accent bar + feed lines on dark."""
    img, draw, s = canvas(size)
    m = int(s * 0.06)
    r = int(s * 0.20)
    rounded_rect(draw, (m, m, s - m, s - m), r, INK)
    bar_w = max(3, int(s * 0.05))
    rounded_rect(draw, (m, m, m + bar_w, s - m), max(1, bar_w // 2), RED)
    feed_lines(draw, s, pad_x_ratio=0.20, fill=ZINC_LIGHT)
    return down(img, size)


def icon_h_blocky_slash(size: int) -> Image.Image:
    """H — Square tile, square lines, square slash ends. Blocky E1 sibling."""
    img, draw, s = canvas(size)
    m = int(s * 0.08)
    draw.rectangle((m, m, s - m, s - m), fill=ZINC)
    pad_x = int(s * 0.20)
    thick = max(2, int(s * 0.05))
    y0, y1 = int(s * 0.34), int(s * 0.68)
    for i, y in enumerate([y0, (y0 + y1) // 2, y1]):
        right = pad_x if i < 2 else pad_x + int(s * 0.14)
        draw.rectangle((pad_x, y, s - right, y + thick), fill=MUTED)
    w = max(3, int(s * 0.10))
    inset = int(s * 0.10)
    draw.line([(inset, inset), (s - inset, s - inset)], fill=RED, width=w)
    return down(img, size)


CONCEPTS: list[tuple[str, str, Callable[[int], Image.Image]]] = [
    ("a-current", "A — Current (ships today)", icon_a_current),
    ("b-dark-slash", "B — Dark tile + slash", icon_b_dark_slash),
    ("b-rounded", "B′ — Dark slash (rounded)", icon_b_rounded),
    ("c-slashed-feed", "C — Slashed middle line", icon_c_slashed_feed),
    ("c-dotted-feed", "C′ — Dotted middle line", icon_c_dotted_feed),
    ("c-feed-slash", "C″ — Feed tile + slash", icon_c_with_slash),
    ("c-feed-circle-slash", "C‴ — Feed tile + circle-slash", icon_c_with_circle_slash),
    ("d-monogram", "D — NS monogram stamp", icon_d_monogram),
    ("e-circle-only", "E — Circle-slash only", icon_e_circle_only),
    ("f-corner-badge", "F — Outlined card + badge", icon_f_outlined_card),
    ("g-accent-bar", "G — E1 accent bar", icon_g_accent_bar),
    ("h-blocky", "H — Blocky square tile", icon_h_blocky_slash),
]


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    out = root / "concepts" / "icons"
    out.mkdir(parents=True, exist_ok=True)

    for slug, _label, draw_fn in CONCEPTS:
        for px, suffix in ((PREVIEW, "128"), (TOOLBAR, "32"), (16, "16")):
            path = out / f"{slug}-{suffix}.png"
            draw_fn(px).save(path, "PNG", optimize=True)
        print(f"wrote {slug}")

    # Manifest for HTML page
    import json

    manifest = [{"slug": s, "label": l} for s, l, _ in CONCEPTS]
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
