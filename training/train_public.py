#!/usr/bin/env python3
"""
One-command training from PUBLIC dataset (no /collect recording).

Steps:
  1. Download WLASL videos (Kaggle — one time, ~5 GB)
  2. python train_public.py

Or if data already prepared:
  python train_public.py --data exports/wlasl_prepared.json --skip-prepare
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str]) -> None:
    print("\n>>", " ".join(cmd))
    subprocess.check_call(cmd, cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description="Train SignBridge from WLASL (no webcam recording)")
    parser.add_argument("--wlasl-json", default="data/WLASL_v0.3.json")
    parser.add_argument("--videos-dir", default="data/kaggle")
    parser.add_argument("--vocabulary", default="../public/vocabularies/daily.json")
    parser.add_argument("--data", default="exports/wlasl_prepared.json")
    parser.add_argument("--output", default="../public/models/lstm")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--max-clips-per-word", type=int, default=40)
    parser.add_argument("--skip-prepare", action="store_true")
    parser.add_argument("--download-json", action="store_true", help="Auto-download WLASL_v0.3.json")
    args = parser.parse_args()

    videos = ROOT / args.videos_dir
    data_path = ROOT / args.data

    print("=" * 60)
    print("SignBridge — Public dataset training")
    print("=" * 60)

    if not args.skip_prepare:
        if not videos.is_dir() or not any(videos.rglob("*.mp4")):
            print(
                """
VIDEO FOLDER NOT FOUND
======================
You do NOT need to record signs in the app. You DO need WLASL videos once:

  Option A — Kaggle (recommended, ~5 GB, one download):
    1. Create account: https://www.kaggle.com
    2. pip install kaggle
    3. Kaggle → Account → Create API token → save kaggle.json to:
         Windows: C:\\Users\\YOURNAME\\.kaggle\\kaggle.json
    4. Run:
         kaggle datasets download -d risangbaskoro/wlasl-processed -p training/data/kaggle --unzip
    5. Point videos at the folder containing .mp4 files, e.g.:
         python train_public.py --videos-dir data/kaggle

  Option B — Official WLASL (smaller, more setup):
    https://github.com/dxli94/WLASL

See TRAINING_NO_RECORDING.md for full steps.
"""
            )
            sys.exit(1)

        prepare_cmd = [
            sys.executable,
            "prepare_from_wlasl.py",
            "--wlasl-json",
            args.wlasl_json,
            "--videos-dir",
            args.videos_dir,
            "--vocabulary",
            args.vocabulary,
            "--output",
            args.data,
            "--max-clips-per-word",
            str(args.max_clips_per_word),
        ]
        if args.download_json:
            prepare_cmd.append("--download-json")
        run(prepare_cmd)

    if not data_path.is_file():
        print(f"Training data not found: {data_path}")
        sys.exit(1)

    run(
        [
            sys.executable,
            "train_tcn.py",
            "--data",
            args.data,
            "--output",
            args.output,
            "--epochs",
            str(max(args.epochs, 80)),
        ]
    )

    run(
        [
            sys.executable,
            "evaluate_model.py",
            "--data",
            args.data,
            "--model",
            args.output,
        ]
    )

    print("\n" + "=" * 60)
    print("SUCCESS")
    print("=" * 60)
    print("Restart the app:  npm run dev")
    print("Open /translate — badge should show TCN")
    print("\nNote: WLASL signers differ from you. For best live accuracy,")
    print("add 10–20 reps of YOUR signing in /collect and merge + retrain.")


if __name__ == "__main__":
    main()
