#!/usr/bin/env python3
"""
Convert WLASL videos → SignBridge training JSON (no manual /collect recording).

Requires:
  1. WLASL_v0.3.json  (annotation file)
  2. Folder of .mp4 videos (from Kaggle or official WLASL download)

Example:
  python prepare_from_wlasl.py ^
    --wlasl-json data/WLASL_v0.3.json ^
    --videos-dir data/videos ^
    --vocabulary ../public/vocabularies/daily.json ^
    --output exports/wlasl_daily.json ^
    --max-clips-per-word 40
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import mediapipe as mp
from tqdm import tqdm

from serialize_frame import frame_has_hands, holistic_to_frame

# Gloss aliases: SignBridge uppercase → WLASL lowercase gloss in dataset
GLOSS_ALIASES = {
    "THANK": ["thank", "thanks", "thank you"],
    "HELLO": ["hello", "hi"],
    "YES": ["yes"],
    "NO": ["no"],
}


def load_vocabulary(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [w.upper() for w in data.get("words", [])]


def download_wlasl_json(dest: Path) -> bool:
    import urllib.request

    urls = [
        "https://raw.githubusercontent.com/dxli94/WLASL/master/start_kit/WLASL_v0.3.json",
        "https://raw.githubusercontent.com/dxli94/WLASL/master/start_kit/WLASL_v0.3.json",
    ]
    dest.parent.mkdir(parents=True, exist_ok=True)
    for url in urls:
        try:
            print(f"Downloading {url} ...")
            urllib.request.urlretrieve(url, dest)
            return True
        except Exception as e:
            print(f"  failed: {e}")
    return False


def find_video(video_id: str, videos_dir: Path) -> Path | None:
    candidates = [
        videos_dir / f"{video_id}.mp4",
        videos_dir / video_id / f"{video_id}.mp4",
        videos_dir / f"{video_id}" / "video.mp4",
    ]
    for p in candidates:
        if p.is_file():
            return p

    # Slow fallback: search tree (Kaggle layouts vary)
    for p in videos_dir.rglob(f"{video_id}.mp4"):
        return p
    for p in videos_dir.rglob(f"*{video_id}*.mp4"):
        if p.is_file():
            return p
    return None


def build_gloss_index(wlasl_data: list) -> dict[str, list]:
    """Map lowercase gloss → list of instances."""
    index: dict[str, list] = {}
    for entry in wlasl_data:
        gloss = entry.get("gloss", "").strip().lower()
        if not gloss:
            continue
        index.setdefault(gloss, []).extend(entry.get("instances", []))
    return index


def resolve_wlasl_glosses(target_word: str, gloss_index: dict) -> list[str]:
    w = target_word.upper()
    if w in GLOSS_ALIASES:
        keys = GLOSS_ALIASES[w]
    else:
        keys = [w.lower()]
    found = []
    for k in keys:
        if k in gloss_index:
            found.append(k)
    return found


def extract_clip_frames(video_path: Path, start_frame: int, end_frame: int, min_frames: int = 8):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frames = []
    frame_idx = 0

    mp_holistic = mp.solutions.holistic
    with mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as holistic:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break

            if start_frame <= frame_idx <= end_frame:
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                result = holistic.process(rgb)
                ts = int((frame_idx / fps) * 1000)
                frame = holistic_to_frame(result, ts)
                if frame_has_hands(frame):
                    frames.append(frame)

            frame_idx += 1
            if frame_idx > end_frame:
                break

    cap.release()

    if len(frames) < min_frames:
        return None
    return frames


def main():
    parser = argparse.ArgumentParser(description="WLASL → SignBridge training JSON")
    parser.add_argument("--wlasl-json", default="data/WLASL_v0.3.json")
    parser.add_argument("--videos-dir", default="data/videos")
    parser.add_argument("--vocabulary", default="../public/vocabularies/daily.json")
    parser.add_argument("--output", default="exports/wlasl_prepared.json")
    parser.add_argument("--max-clips-per-word", type=int, default=40)
    parser.add_argument("--max-words", type=int, default=0, help="Limit words (0 = all in vocabulary)")
    parser.add_argument("--split", default="train", help="WLASL split filter: train | val | test | any")
    parser.add_argument("--download-json", action="store_true", help="Download WLASL_v0.3.json if missing")
    args = parser.parse_args()

    wlasl_path = Path(args.wlasl_json)
    videos_dir = Path(args.videos_dir)
    out_path = Path(args.output)

    if not wlasl_path.is_file():
        if args.download_json:
            if not download_wlasl_json(wlasl_path):
                print("Could not download WLASL JSON. Download manually from:")
                print("  https://github.com/dxli94/WLASL")
                sys.exit(1)
        else:
            print(f"Missing {wlasl_path}")
            print("Run with --download-json or place WLASL_v0.3.json there.")
            sys.exit(1)

    if not videos_dir.is_dir():
        print(f"Missing videos folder: {videos_dir}")
        print("\nDownload WLASL videos (see TRAINING_NO_RECORDING.md):")
        print("  Kaggle: https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed")
        print("  Unzip so .mp4 files are under data/videos/")
        sys.exit(1)

    vocabulary = load_vocabulary(args.vocabulary)
    if args.max_words > 0:
        vocabulary = vocabulary[: args.max_words]

    with open(wlasl_path, "r", encoding="utf-8") as f:
        wlasl_data = json.load(f)

    gloss_index = build_gloss_index(wlasl_data)

    samples = []
    stats = {"words": 0, "skipped_no_gloss": 0, "skipped_no_video": 0, "skipped_extract": 0}

    for word in tqdm(vocabulary, desc="Words"):
        gloss_keys = resolve_wlasl_glosses(word, gloss_index)
        if not gloss_keys:
            stats["skipped_no_gloss"] += 1
            continue

        instances = []
        for gk in gloss_keys:
            instances.extend(gloss_index[gk])

        if args.split != "any":
            instances = [i for i in instances if i.get("split") == args.split]

        added = 0
        for inst in instances:
            if added >= args.max_clips_per_word:
                break

            video_id = inst.get("video_id") or inst.get("instance_id", "")
            if not video_id:
                continue

            video_path = find_video(str(video_id), videos_dir)
            if not video_path:
                stats["skipped_no_video"] += 1
                continue

            start = int(inst.get("frame_start", 0))
            end = int(inst.get("frame_end", start + 30))

            frames = extract_clip_frames(video_path, start, end)
            if not frames:
                stats["skipped_extract"] += 1
                continue

            samples.append({"id": f"wlasl-{word}-{added}", "word": word, "frames": frames, "source": "wlasl"})
            added += 1

        if added > 0:
            stats["words"] += 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "samples": samples,
        "templates": [],
        "source": "wlasl",
        "vocabulary": vocabulary,
        "stats": stats,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)

    print(f"\nDone: {len(samples)} clips, {stats['words']} words with data")
    print(f"Saved: {out_path}")
    print(f"Skipped — no gloss in WLASL: {stats['skipped_no_gloss']}")
    print(f"Skipped — video file missing: {stats['skipped_no_video']}")
    print(f"Skipped — extraction failed: {stats['skipped_extract']}")

    if len(samples) < 100:
        print("\nWARNING: Very few clips. Check videos-dir path and Kaggle download.")
        sys.exit(1)


if __name__ == "__main__":
    main()
