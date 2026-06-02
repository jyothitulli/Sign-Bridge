#!/usr/bin/env python3
"""
Build continuous gloss sequences for CTC training.

Stitches isolated SignBridge/WLASL clips (per word) into sentence-length clips
using gloss2en JSONL sentence labels.

  python prepare_gloss2en.py
  python prepare_continuous_gloss.py \\
    --gloss2en exports/gloss2en_train.jsonl \\
    --isolated exports/wlasl_prepared.json \\
    --output exports/continuous_gloss.json
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

try:
    from feature_extract import frame_to_hand_vector
except ModuleNotFoundError as e:
    if "numpy" in str(e).lower():
        raise SystemExit(
            "Missing Python packages. Run from project root:\n"
            "  npm run setup:training:base\n"
            "  (or: python -m pip install -r training/requirements-base.txt)"
        ) from e
    raise

GAP_FRAMES = 4
FRAMES_PER_SIGN = 30


def load_isolated_by_word(path: Path) -> dict[str, list[list]]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    by_word: dict[str, list[list]] = {}
    for sample in data.get("samples", []):
        word = sample.get("word", "").split("_")[0].upper()
        frames = sample.get("frames", [])
        if word and frames:
            by_word.setdefault(word, []).append(frames)
    return by_word


def stitch_sentence(gloss: list[str], by_word: dict[str, list[list]], rng: random.Random) -> list | None:
    out: list = []
    for word in gloss:
        clips = by_word.get(word)
        if not clips:
            return None
        clip = rng.choice(clips)
        vectors = [frame_to_hand_vector(f).tolist() for f in clip]
        if len(vectors) > FRAMES_PER_SIGN:
            step = len(vectors) / FRAMES_PER_SIGN
            vectors = [vectors[int(i * step)] for i in range(FRAMES_PER_SIGN)]
        elif len(vectors) < FRAMES_PER_SIGN:
            pad = [vectors[-1] if vectors else [0.0] * 84] * (FRAMES_PER_SIGN - len(vectors))
            vectors = vectors + pad
        out.extend(vectors)
        out.extend([[0.0] * 84] * GAP_FRAMES)
    return out[:-GAP_FRAMES] if out else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gloss2en", default="exports/gloss2en_train.jsonl")
    parser.add_argument("--isolated", default="exports/wlasl_prepared.json")
    parser.add_argument("--output", default="exports/continuous_gloss.json")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    isolated_path = Path(args.isolated)
    if not isolated_path.is_file():
        print(f"Missing {isolated_path} - run prepare_from_wlasl.py or npm run train:wlasl first.")
        raise SystemExit(1)

    by_word = load_isolated_by_word(isolated_path)
    rng = random.Random(args.seed)

    sequences = []
    skipped = 0
    with open(args.gloss2en, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            gloss = row["gloss"]
            if isinstance(gloss, str):
                gloss = gloss.upper().split()
            vectors = stitch_sentence(gloss, by_word, rng)
            if vectors is None:
                skipped += 1
                continue
            sequences.append(
                {
                    "gloss": gloss,
                    "english": row.get("english", ""),
                    "vectors": vectors,
                    "length": len(vectors),
                }
            )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"sequences": sequences, "featureDim": 84}, f)

    print(f"Wrote {len(sequences)} continuous sequences -> {out} (skipped {skipped})")
    if sequences:
        print("Next: python train_gloss_ctc.py --data", out)


if __name__ == "__main__":
    main()
