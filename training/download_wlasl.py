#!/usr/bin/env python3
"""
Download WLASL processed videos from Kaggle (~5 GB, one-time).

  python training/download_wlasl.py

Requires:
  pip install kaggle
  C:\\Users\\YOU\\.kaggle\\kaggle.json  (Kaggle → Account → Create API token)
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "kaggle"
DATASET = "risangbaskoro/wlasl-processed"


def kaggle_json() -> Path | None:
    env = os.environ.get("KAGGLE_CONFIG_DIR")
    if env:
        p = Path(env) / "kaggle.json"
        if p.is_file():
            return p
    home = Path.home() / ".kaggle" / "kaggle.json"
    return home if home.is_file() else None


def main() -> None:
    token = kaggle_json()
    if not token:
        home = Path.home()
        print(
            f"""
Kaggle API token not found
==========================
1. https://www.kaggle.com → Account → Create New API Token
2. Save as:  {home / ".kaggle" / "kaggle.json"}
3. Re-run:   npm run download:wlasl
"""
        )
        sys.exit(1)

    OUT.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "kaggle",
        "datasets",
        "download",
        "-d",
        DATASET,
        "-p",
        str(OUT),
        "--unzip",
    ]
    print(">>", " ".join(cmd))
    print(f"Output: {OUT}")
    subprocess.check_call(cmd, cwd=ROOT)

    mp4 = list(OUT.rglob("*.mp4"))
    print(f"\nDone. Found {len(mp4)} .mp4 files under {OUT}")
    if mp4:
        print("Next: npm run train:wlasl")


if __name__ == "__main__":
    main()
