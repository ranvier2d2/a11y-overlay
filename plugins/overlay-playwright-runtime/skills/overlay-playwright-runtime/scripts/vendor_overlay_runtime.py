#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_ASSET_ROOT = Path(__file__).resolve().parent.parent / "assets" / "runtime"
DEFAULT_MANIFEST_RELATIVE_PATH = Path(".codex") / "overlay-playwright-runtime" / "vendor-manifest.json"
FILES_TO_COPY = (
    ("a11y-overlay.js", "a11y-overlay.js"),
    ("playwright/overlay-client.mjs", "playwright/overlay-client.mjs"),
)


@dataclass(frozen=True)
class SourceFile:
    source_path: Path
    target_relative_path: Path
    source_sha256: str


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
        help="Overwrite existing files that differ from the bundled assets."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned operations without copying or deleting files."
    )
    parser.add_argument(
        "--temporary",
        action="store_true",
        help="Record copied files in a manifest so they can be cleaned up after an audit-only run."
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Remove files previously copied with --temporary, preserving any that changed since vendoring."
    )
    parser.add_argument(
        "--manifest-path",
        help=(
            "Override the vendoring manifest path. Defaults to "
            f"{DEFAULT_MANIFEST_RELATIVE_PATH.as_posix()} inside the target root."
        ),
    )
    return parser.parse_args()


def sha256_for_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_path_for_args(target_root: Path, args: argparse.Namespace) -> Path:
    if args.manifest_path:
        return Path(args.manifest_path).expanduser().resolve()
    return (target_root / DEFAULT_MANIFEST_RELATIVE_PATH).resolve()


def ensure_source_files(asset_root: Path) -> list[SourceFile]:
    resolved: list[SourceFile] = []
    missing: list[str] = []

    for source_rel, target_rel in FILES_TO_COPY:
        source_path = asset_root / source_rel
        if not source_path.exists():
            missing.append(str(source_path))
            continue
        resolved.append(
            SourceFile(
                source_path=source_path,
                target_relative_path=Path(target_rel),
                source_sha256=sha256_for_path(source_path),
            )
        )

    if missing:
        joined = "\n".join(missing)
        raise FileNotFoundError(f"missing source files:\n{joined}")

    return resolved


def prune_empty_parents(start: Path, stop_at: Path, dry_run: bool) -> None:
    current = start
    while current != stop_at and current != current.parent:
        if current.exists() and any(current.iterdir()):
            break
        print(f"{'would remove empty dir' if dry_run else 'remove empty dir'} {current}")
        if dry_run:
            break
        current.rmdir()
        current = current.parent


def load_manifest(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest not found: {manifest_path}")
    return json.loads(manifest_path.read_text("utf8"))


def write_manifest(manifest_path: Path, payload: dict, dry_run: bool) -> None:
    print(f"{'would write' if dry_run else 'write'} manifest {manifest_path}")
    if dry_run:
        return
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n", "utf8")


def run_cleanup(target_root: Path, manifest_path: Path, dry_run: bool) -> int:
    try:
        manifest = load_manifest(manifest_path)
    except FileNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 5

    if str(target_root) != manifest.get("targetRoot"):
        print(
            "error: manifest target root does not match the requested target root:\n"
            f"  manifest: {manifest.get('targetRoot')}\n"
            f"  target:   {target_root}",
            file=sys.stderr,
        )
        return 6

    remaining: list[dict] = []
    removed = 0

    for record in manifest.get("copied", []):
        relative_path = Path(record["path"])
        target_path = target_root / relative_path
        expected_sha = record["sha256"]

        if not target_path.exists():
            print(f"skip missing {target_path}")
            continue

        if sha256_for_path(target_path) != expected_sha:
            print(f"preserve modified {target_path}")
            remaining.append(record)
            continue

        print(f"{'would remove' if dry_run else 'remove'} {target_path}")
        if not dry_run:
            target_path.unlink()
            prune_empty_parents(target_path.parent, target_root, dry_run=False)
        removed += 1

    if remaining:
        manifest["copied"] = remaining
        write_manifest(manifest_path, manifest, dry_run)
        print(f"cleanup incomplete: preserved {len(remaining)} modified file(s)")
        return 0

    print(f"{'would remove' if dry_run else 'remove'} manifest {manifest_path}")
    if not dry_run and manifest_path.exists():
        manifest_path.unlink()
        prune_empty_parents(manifest_path.parent, target_root, dry_run=False)

    print(f"cleanup complete: removed {removed} file(s)")
    return 0


def main() -> int:
    args = parse_args()
    if args.cleanup and args.force:
      print("error: --cleanup cannot be combined with --force", file=sys.stderr)
      return 2
    if args.cleanup and args.temporary:
      print("error: choose either --temporary or --cleanup, not both", file=sys.stderr)
      return 2

    asset_root = DEFAULT_ASSET_ROOT.resolve()
    target_root = Path(args.target_root).expanduser().resolve()
    manifest_path = manifest_path_for_args(target_root, args)

    if not target_root.exists():
        print(f"error: target root does not exist: {target_root}", file=sys.stderr)
        return 2
    if not target_root.is_dir():
        print(f"error: target root is not a directory: {target_root}", file=sys.stderr)
        return 2

    if args.cleanup:
        return run_cleanup(target_root, manifest_path, args.dry_run)

    try:
        source_files = ensure_source_files(asset_root)
    except FileNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 3

    conflicts: list[Path] = []
    copied_records: list[dict] = []
    reused: list[Path] = []

    for source in source_files:
        target_path = target_root / source.target_relative_path
        if target_path.exists():
            target_sha = sha256_for_path(target_path)
            if target_sha == source.source_sha256:
                reused.append(target_path)
                print(f"reuse compatible {target_path}")
                continue
            if not args.force:
                conflicts.append(target_path)
                continue

        print(f"{'would copy' if args.dry_run else 'copy'} {source.source_path} -> {target_path}")
        copied_records.append({
            "path": source.target_relative_path.as_posix(),
            "sha256": source.source_sha256,
        })
        if args.dry_run:
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source.source_path, target_path)

    if conflicts:
        joined = "\n".join(str(path) for path in conflicts)
        print(
            "error: target files differ from the bundled assets. Re-run with --force to overwrite:\n"
            f"{joined}",
            file=sys.stderr,
        )
        return 4

    if args.temporary:
        payload = {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "targetRoot": str(target_root),
            "copied": copied_records,
            "reused": [path.relative_to(target_root).as_posix() for path in reused],
        }
        write_manifest(manifest_path, payload, args.dry_run)

    if args.dry_run:
        print("dry run complete")
    elif copied_records:
        print("overlay runtime vendored successfully")
    else:
        print("overlay runtime already compatible; nothing copied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
