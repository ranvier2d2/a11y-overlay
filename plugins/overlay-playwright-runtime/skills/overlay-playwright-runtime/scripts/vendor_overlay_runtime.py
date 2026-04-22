#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


DEFAULT_ASSET_ROOT = Path(__file__).resolve().parent.parent / "assets" / "runtime"
FILES_TO_COPY = (
    ("a11y-overlay.js", "a11y-overlay.js"),
    ("playwright/overlay-client.mjs", "playwright/overlay-client.mjs"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Vendor the a11y-overlay runtime and Playwright client into another repo."
    )
    parser.add_argument(
        "--target-root",
        required=True,
        help="Absolute path to the target repository root."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files in the target repo."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned operations without copying files."
    )
    return parser.parse_args()


def ensure_source_files(asset_root: Path) -> list[tuple[Path, Path]]:
    resolved: list[tuple[Path, Path]] = []
    missing: list[str] = []

    for source_rel, target_rel in FILES_TO_COPY:
      source_path = asset_root / source_rel
      if not source_path.exists():
        missing.append(str(source_path))
      else:
        resolved.append((source_path, Path(target_rel)))

    if missing:
      joined = "\n".join(missing)
      raise FileNotFoundError(f"missing source files:\n{joined}")

    return resolved


def main() -> int:
    args = parse_args()
    asset_root = DEFAULT_ASSET_ROOT.resolve()
    target_root = Path(args.target_root).expanduser().resolve()

    if not target_root.exists():
        print(f"error: target root does not exist: {target_root}", file=sys.stderr)
        return 2
    if not target_root.is_dir():
        print(f"error: target root is not a directory: {target_root}", file=sys.stderr)
        return 2

    try:
        file_pairs = ensure_source_files(asset_root)
    except FileNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 3

    planned_writes: list[tuple[Path, Path]] = []
    conflicts: list[Path] = []

    for source_path, target_rel in file_pairs:
        target_path = target_root / target_rel
        if target_path.exists() and not args.force:
            conflicts.append(target_path)
        planned_writes.append((source_path, target_path))

    if conflicts:
        joined = "\n".join(str(path) for path in conflicts)
        print(
            "error: target files already exist. Re-run with --force to overwrite:\n"
            f"{joined}",
            file=sys.stderr,
        )
        return 4

    for source_path, target_path in planned_writes:
        print(f"{'would copy' if args.dry_run else 'copy'} {source_path} -> {target_path}")
        if args.dry_run:
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)

    if args.dry_run:
        print("dry run complete")
    else:
        print("overlay runtime vendored successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
