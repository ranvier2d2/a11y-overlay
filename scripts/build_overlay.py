#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "src" / "overlay"
OUTPUT = ROOT / "a11y-overlay.js"
MODULE_ORDER = [
    "00-intro.js",
    "10-constants.js",
    "20-shadow-dom.js",
    "30-state.js",
    "40-utils.js",
    "50-detectors.js",
    "60-annotations.js",
    "70-render.js",
    "80-runtime.js",
]


def build_overlay() -> Path:
    parts: list[str] = []
    for module_name in MODULE_ORDER:
        module_path = SOURCE_DIR / module_name
        if not module_path.exists():
            raise SystemExit(f"missing overlay module: {module_path}")
        parts.append(module_path.read_text().rstrip("\n"))

    content = "\n".join(parts)
    if not content.endswith("\n"):
        content += "\n"
    OUTPUT.write_text(content)
    return OUTPUT


def main() -> None:
    output = build_overlay()
    print(f"built {output.relative_to(ROOT)} from {SOURCE_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
