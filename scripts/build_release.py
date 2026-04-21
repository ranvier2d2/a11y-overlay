#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
BUILD = DIST / "build"
EXTENSION_FILES = [
    "a11y-overlay.js",
    "export.html",
    "export.js",
    "manifest.json",
    "service-worker.js",
]
ICON_FILES = [
    "icons/icon-16.png",
    "icons/icon-32.png",
    "icons/icon-48.png",
    "icons/icon-128.png",
]


def load_manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text())


def copy_runtime(stage: Path) -> None:
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    for rel_path in EXTENSION_FILES + ICON_FILES:
        src = ROOT / rel_path
        dest = stage / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def write_zip(source_dir: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(source_dir.rglob("*")):
            if path.is_dir():
                continue
            zf.write(path, path.relative_to(source_dir))


def build_chrome(manifest: dict, version: str) -> Path:
    stage = BUILD / "chrome"
    copy_runtime(stage)
    output = DIST / f"a11y-overlay-chrome-v{version}.zip"
    write_zip(stage, output)
    return output


def build_firefox(manifest: dict, version: str, gecko_id: str, min_version: str) -> Path:
    stage = BUILD / "firefox"
    copy_runtime(stage)

    firefox_manifest = dict(manifest)
    firefox_manifest["browser_specific_settings"] = {
        "gecko": {
            "id": gecko_id,
            "strict_min_version": min_version,
            "data_collection_permissions": {
                "required": ["none"]
            }
        }
    }

    (stage / "manifest.json").write_text(json.dumps(firefox_manifest, indent=2) + "\n")
    output = DIST / f"a11y-overlay-firefox-v{version}.zip"
    write_zip(stage, output)
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build store-ready extension zip packages.")
    parser.add_argument(
        "--firefox",
        action="store_true",
        help="Also build a Firefox package. Requires FIREFOX_EXTENSION_ID or --firefox-id.",
    )
    parser.add_argument(
        "--firefox-id",
        default=os.environ.get("FIREFOX_EXTENSION_ID"),
        help="Firefox gecko.id value for AMO signing.",
    )
    parser.add_argument(
        "--firefox-min-version",
        default="128.0",
        help="Firefox strict_min_version for the Firefox package.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = load_manifest()
    version = manifest["version"]

    DIST.mkdir(exist_ok=True)
    chrome_zip = build_chrome(manifest, version)
    print(f"built {chrome_zip.relative_to(ROOT)}")

    if args.firefox:
        if not args.firefox_id:
            raise SystemExit("Firefox build requested but no gecko.id was provided.")
        firefox_zip = build_firefox(manifest, version, args.firefox_id, args.firefox_min_version)
        print(f"built {firefox_zip.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
