#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "icons"
SIZES = (16, 32, 48, 128)


def draw_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), "#0c0a09")
    draw = ImageDraw.Draw(image)

    pad = max(1, size // 12)
    stroke = max(1, size // 16)
    inner = max(2, size // 5)

    draw.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=max(2, size // 6),
        outline="#a3e635",
        width=stroke,
    )

    draw.rounded_rectangle(
        (inner, inner, size - inner - 1, size - inner - 1),
        radius=max(2, size // 7),
        outline="#22d3ee",
        width=stroke,
    )

    bar_w = max(1, size // 10)
    gap = max(1, size // 14)
    x0 = size // 2 - bar_w - gap // 2
    x1 = x0 + bar_w
    x2 = x1 + gap
    x3 = x2 + bar_w
    top = max(inner + stroke, size // 4)
    bottom = size - top

    draw.rounded_rectangle(
        (x0, top, x1, bottom),
        radius=max(1, bar_w // 2),
        fill="#f59e0b",
    )
    draw.rounded_rectangle(
        (x2, top + max(1, size // 10), x3, bottom - max(1, size // 10)),
        radius=max(1, bar_w // 2),
        fill="#fb7185",
    )

    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        draw_icon(size).save(OUT_DIR / f"icon-{size}.png")
    print(f"generated {len(SIZES)} icons in {OUT_DIR}")


if __name__ == "__main__":
    main()
