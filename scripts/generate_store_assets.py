#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "store-assets"
EDGE = STORE / "edge"

BG = "#0c0a09"
PANEL = "#151210"
BORDER = "#292524"
TEXT = "#e7e5e4"
MUTED = "#a8a29e"
LIME = "#a3e635"
CYAN = "#22d3ee"
AMBER = "#f59e0b"
ROSE = "#fb7185"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def save_rgb_variants(image: Image.Image, base_path: Path) -> None:
    rgb = image.convert("RGB")
    rgb.save(base_path.with_suffix(".png"))
    rgb.save(base_path.with_suffix(".jpg"), quality=95, subsampling=0)


def draw_app_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)

    pad = max(6, size // 12)
    stroke = max(4, size // 18)
    inner = max(16, size // 5)

    draw.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=max(16, size // 6),
        outline=LIME,
        width=stroke,
    )
    draw.rounded_rectangle(
        (inner, inner, size - inner - 1, size - inner - 1),
        radius=max(14, size // 7),
        outline=CYAN,
        width=stroke,
    )

    bar_w = max(12, size // 10)
    gap = max(10, size // 14)
    x0 = size // 2 - bar_w - gap // 2
    x1 = x0 + bar_w
    x2 = x1 + gap
    x3 = x2 + bar_w
    top = max(inner + stroke, size // 4)
    bottom = size - top

    draw.rounded_rectangle((x0, top, x1, bottom), radius=bar_w // 2, fill=AMBER)
    draw.rounded_rectangle((x2, top + size // 10, x3, bottom - size // 10), radius=bar_w // 2, fill=ROSE)
    return image


def draw_tile(width: int, height: int, dest_stem: str) -> None:
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    margin = int(width * 0.06)
    draw.rounded_rectangle(
        (margin, margin, width - margin, height - margin),
        radius=max(12, height // 18),
        fill=PANEL,
        outline=BORDER,
        width=max(2, height // 90),
    )

    icon_size = int(height * 0.52)
    icon = draw_app_icon(icon_size).convert("RGB")
    icon_y = (height - icon_size) // 2
    image.paste(icon, (margin + int(height * 0.08), icon_y))

    title_font = load_font(max(22, height // 10), bold=True)
    body_font = load_font(max(14, height // 18))
    eyebrow_font = load_font(max(12, height // 22), bold=True)

    text_x = margin + int(height * 0.08) + icon_size + int(width * 0.04)
    draw.text((text_x, margin + int(height * 0.14)), "A11Y-OVERLAY", fill=LIME, font=eyebrow_font)
    draw.text((text_x, margin + int(height * 0.30)), "Visualize page structure", fill=TEXT, font=title_font)
    draw.text((text_x, margin + int(height * 0.50)), "Landmarks, headings, focus order, depth, and layout layers.", fill=MUTED, font=body_font)

    save_rgb_variants(image, EDGE / dest_stem)


def main() -> None:
    EDGE.mkdir(parents=True, exist_ok=True)

    save_rgb_variants(draw_app_icon(300), EDGE / "edge-logo-300")
    draw_tile(440, 280, "edge-small-promotional-tile-440x280")
    draw_tile(1400, 560, "edge-large-promotional-tile-1400x560")

    print(f"generated edge assets in {EDGE}")


if __name__ == "__main__":
    main()
