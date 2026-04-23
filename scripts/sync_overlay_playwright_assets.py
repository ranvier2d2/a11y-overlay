#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
PLAYWRIGHT_ROOT = REPO_ROOT / "playwright"
PLUGIN_ROOT = (
    REPO_ROOT
    / "plugins"
    / "overlay-playwright-runtime"
    / "skills"
    / "overlay-playwright-runtime"
)

SYNC_PAIRS = [
    (
        PLAYWRIGHT_ROOT / "overlay-client.mjs",
        PLUGIN_ROOT / "assets" / "runtime" / "playwright" / "overlay-client.mjs",
    ),
    (
        PLAYWRIGHT_ROOT / "overlay-client-live.mjs",
        PLUGIN_ROOT / "assets" / "runtime" / "playwright" / "overlay-client-live.mjs",
    ),
    (
        PLAYWRIGHT_ROOT / "overlay-client-live.mjs",
        PLUGIN_ROOT / "assets" / "sandbox" / "overlay-client-live.mjs",
    ),
]


def main() -> int:
    for source, target in SYNC_PAIRS:
        if not source.exists():
            raise FileNotFoundError(f"missing canonical source: {source}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"sync {source} -> {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
