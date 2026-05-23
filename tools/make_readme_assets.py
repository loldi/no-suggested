#!/usr/bin/env python3
"""Render docs/popup-screenshot.png for the README hero."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "popup-screenshot.png"
ICON = ROOT / "icons" / "icon32.png"
SCALE = 2
W = 300 * SCALE

BG = (24, 24, 27)
RAISED = (31, 31, 35)
INSET = (20, 20, 22)
INK = (250, 250, 250)
MUTED = (161, 161, 170)
FAINT = (113, 113, 122)
BORDER = (39, 39, 42)
ACCENT = (220, 38, 38)
ON_TRACK = (22, 101, 52)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    if not path.exists():
        path = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(str(path), size * SCALE)


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline)


def draw_toggle(draw: ImageDraw.ImageDraw, x: int, y: int, on: bool = True) -> None:
    track = ON_TRACK if on else BORDER
    rounded_rect(draw, (x, y, x + 72, y + 40), 20, track)
    thumb_x = x + 44 if on else x + 4
    rounded_rect(draw, (thumb_x, y + 4, thumb_x + 32, y + 36), 16, (255, 255, 255))


def draw_checkbox(draw: ImageDraw.ImageDraw, x: int, y: int, checked: bool = True) -> None:
    rounded_rect(draw, (x, y, x + 28, y + 28), 6, INSET, outline=BORDER)
    if checked:
        draw.line((x + 7, y + 14, x + 12, y + 20), fill=ACCENT, width=3)
        draw.line((x + 12, y + 20, x + 21, y + 8), fill=ACCENT, width=3)


def main() -> int:
    OUT.parent.mkdir(exist_ok=True)
    f_title = font(13, bold=True)
    f_body = font(11)
    f_small = font(10)
    f_tiny = font(9)
    f_mono = font(9)

    h = 460 * SCALE
    img = Image.new("RGBA", (W + 6 * SCALE, h), (0, 0, 0, 0))
    panel = Image.new("RGBA", (W, h), BG)
    draw = ImageDraw.Draw(panel)

    # Accent stripe
    draw.rectangle((0, 0, 6 * SCALE, h), fill=ACCENT)

    pad = 14 * SCALE

    # Header row
    icon = Image.open(ICON).convert("RGBA").resize((22 * SCALE, 22 * SCALE), Image.LANCZOS)
    panel.paste(icon, (pad + 6 * SCALE, 12 * SCALE), icon)
    draw.text((pad + 34 * SCALE, 14 * SCALE), "No Suggested", fill=INK, font=f_title)
    draw_toggle(draw, W - pad - 72, 12 * SCALE, on=True)

    stats = "12 this page · 847 lifetime · 3 manual blocks"
    draw.text((pad + 6 * SCALE, 44 * SCALE), stats, fill=MUTED, font=f_body)

    # Explainer + button
    y = 78 * SCALE
    explainer = (
        "Suggested posts hide automatically. Use manual block when something else "
        "slips through — you'll pick it directly on the feed."
    )
    draw.multiline_text((pad + 6 * SCALE, y), explainer, fill=FAINT, font=f_small, spacing=4)

    y = 132 * SCALE
    rounded_rect(draw, (pad + 6 * SCALE, y, W - pad, y + 74 * SCALE), 10 * SCALE, RAISED, outline=BORDER)
    draw.text((pad + 18 * SCALE, y + 12 * SCALE), "Block a post manually", fill=INK, font=f_body)
    draw.text(
        (pad + 18 * SCALE, y + 34 * SCALE),
        "Click a feed card on the page to hide it permanently",
        fill=FAINT,
        font=f_small,
    )
    rounded_rect(draw, (W - pad - 92 * SCALE, y + 22 * SCALE, W - pad - 18 * SCALE, y + 50 * SCALE), 6 * SCALE, INSET, outline=BORDER)
    draw.text((W - pad - 84 * SCALE, y + 28 * SCALE), "Alt+Shift+H", fill=FAINT, font=f_mono)

    # Manual blocks
    y = 224 * SCALE
    draw.text((pad + 6 * SCALE, y), "MANUAL BLOCKS", fill=FAINT, font=f_tiny)
    draw.text((W - pad - 70 * SCALE, y), "Clear all", fill=(252, 165, 165), font=f_small)

    y = 248 * SCALE
    rounded_rect(draw, (pad + 6 * SCALE, y, W - pad, y + 108 * SCALE), 10 * SCALE, INSET, outline=BORDER)
    rows = [
        ("author", "Jane Recruiter"),
        ("author", "Thought Leader LLC"),
        ("post", "Another AI webinar…"),
    ]
    row_h = 36 * SCALE
    for i, (kind, label) in enumerate(rows):
        ry = y + i * row_h + 8 * SCALE
        rounded_rect(draw, (pad + 18 * SCALE, ry, pad + 78 * SCALE, ry + 20 * SCALE), 10 * SCALE, BG)
        draw.text((pad + 24 * SCALE, ry + 2 * SCALE), kind, fill=FAINT, font=f_tiny)
        draw.text((pad + 88 * SCALE, ry + 2 * SCALE), label, fill=INK, font=f_body)
        rounded_rect(draw, (W - pad - 78 * SCALE, ry - 2 * SCALE, W - pad - 18 * SCALE, ry + 24 * SCALE), 12 * SCALE, BG, outline=BORDER)
        draw.text((W - pad - 68 * SCALE, ry + 2 * SCALE), "Undo", fill=MUTED, font=f_small)
        if i < len(rows) - 1:
            draw.line((pad + 18 * SCALE, y + (i + 1) * row_h, W - pad - 18 * SCALE, y + (i + 1) * row_h), fill=BORDER)

    # Settings + footer
    y = 372 * SCALE
    draw.line((pad + 6 * SCALE, y, W - pad, y), fill=BORDER)
    y += 16 * SCALE
    draw_checkbox(draw, pad + 6 * SCALE, y, checked=True)
    draw.text((pad + 44 * SCALE, y + 4 * SCALE), "Show count on toolbar icon", fill=MUTED, font=f_body)

    y += 44 * SCALE
    draw.line((pad + 6 * SCALE, y, W - pad, y), fill=BORDER)
    y += 12 * SCALE
    draw.text((pad + 6 * SCALE, y), "github.com/loldi/no-suggested", fill=FAINT, font=f_tiny)
    draw.text((W - pad - 44 * SCALE, y), "v1.2.1", fill=FAINT, font=f_tiny)

    img.paste(panel, (0, 0), panel)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
