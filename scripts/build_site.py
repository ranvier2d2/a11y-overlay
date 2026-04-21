#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".site-dist"

STATIC_FILES = [
    "landing.html",
    "demo.html",
    "demo.js",
    "reference.html",
    "privacy.html",
    "a11y-overlay.js",
    "landing-full.png",
    "landing-hero.png",
    "github-overlay-default.png",
    "github-overlay-focus.png",
]


def main() -> None:
    subprocess.run(["python3", str(ROOT / "scripts" / "build_overlay.py")], check=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    for rel_path in STATIC_FILES:
        src = ROOT / rel_path
        dest = OUT / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    shutil.copy2(ROOT / "landing.html", OUT / "index.html")
    print(f"staged site in {OUT}")


if __name__ == "__main__":
    main()
