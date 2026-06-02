#!/usr/bin/env python3
"""
Export built-in DTW templates (same peaks as signTemplates.ts) to training JSON.
Use for a quick TCN/LSTM bundle before WLASL download completes.

  python training/export_builtin_templates.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from feature_extract import HAND_VECTOR_DIM

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "exports" / "builtin_demo.json"

# Mirrors src/features/translation/signTemplates.ts PEAKS
PEAKS: list[tuple[str, dict, float]] = [
    ("YOU", {"rightHandActive": True, "rightWristRelX": 0.45, "rightWristRelY": -0.25}, 1.3),
    ("I", {"rightHandActive": True, "rightWristRelX": 0.08, "rightWristRelY": -0.2}, 1.3),
    ("ME", {"rightHandActive": True, "rightWristRelX": 0.05, "rightWristRelY": -0.15}, 1.0),
    ("NAME", {"bothHandsActive": True, "wristsTogether": True, "rightWristRelY": -0.28}, 1.4),
    ("WHAT", {"bothHandsActive": True, "rightWristRelY": -0.38, "fingerSpread": 0.45}, 1.3),
    ("WHERE", {"rightHandActive": True, "rightWristRelX": 0.65, "rightWristRelY": -0.32}, 1.2),
    ("WHEN", {"bothHandsActive": True, "rightWristRelY": -0.38}, 1.0),
    ("WHY", {"rightHandActive": True, "nearFace": True, "rightWristRelY": -0.42}, 1.0),
    ("WHO", {"bothHandsActive": True, "wristsTogether": True}, 1.0),
    ("HOW", {"bothHandsActive": True, "fingerSpread": 0.35}, 1.0),
    ("TIME", {"bothHandsActive": True}, 1.0),
    ("EAT", {"rightHandActive": True, "nearFace": True, "rightWristRelY": -0.48}, 1.4),
    ("GO", {"rightHandActive": True, "rightWristRelX": 0.85}, 1.2),
    ("STORE", {"bothHandsActive": True, "rightWristRelY": 0.05}, 1.0),
    ("SCHOOL", {"bothHandsActive": True, "wristsTogether": True}, 1.0),
    ("HUNGRY", {"bothHandsActive": True, "lowHands": True, "wristsTogether": True}, 1.5),
    ("TIRED", {"bothHandsActive": True, "wristsTogether": True}, 1.3),
    ("VERY", {"bothHandsActive": True, "fingerSpread": 0.5}, 1.0),
    ("HOT", {"bothHandsActive": True, "nearFace": True}, 1.0),
    ("COLD", {"bothHandsActive": True, "wristsTogether": True}, 1.0),
    ("TODAY", {"bothHandsActive": True, "wristsTogether": True}, 1.0),
    ("YESTERDAY", {"rightHandActive": True, "nearFace": True, "rightWristRelY": -0.52}, 1.0),
    ("TOMORROW", {"rightHandActive": True, "rightWristRelY": -0.35}, 1.0),
    ("WEATHER", {"bothHandsActive": True, "rightWristRelY": -0.38}, 1.0),
    ("FEEL", {"bothHandsActive": True, "wristsTogether": True}, 1.0),
    ("HEADACHE", {"bothHandsActive": True, "nearFace": True, "rightWristRelY": -0.55}, 1.4),
    ("FROM", {"rightHandActive": True, "rightWristRelX": -0.55}, 1.0),
    ("HELLO", {"rightHandActive": True, "rightWristRelX": 0.55, "rightWristRelY": -0.58}, 1.0),
    ("THANK", {"rightHandActive": True, "rightWristRelY": 0.02}, 1.0),
    ("YES", {"rightHandActive": True, "rightWristRelY": -0.28}, 1.0),
    ("NO", {"bothHandsActive": True, "rightWristRelX": 0.35}, 1.0),
    ("MY", {"rightHandActive": True, "rightWristRelX": 0.02}, 1.0),
    ("YOUR", {"rightHandActive": True, "rightWristRelX": 0.4}, 1.0),
]


def features_to_vector(f: dict) -> np.ndarray:
    v = np.zeros(HAND_VECTOR_DIM, dtype=np.float32)
    v[0] = f.get("rightWristRelX", 0)
    v[1] = f.get("rightWristRelY", 0)
    v[42] = f.get("leftWristRelX", 0)
    v[43] = f.get("leftWristRelY", 0)
    spread = f.get("fingerSpread", 0)
    v[2] = spread
    v[44] = spread
    if f.get("nearFace"):
        v[4] = 1
    if f.get("lowHands"):
        v[5] = 1
    if f.get("wristsTogether"):
        v[6] = 1
    if f.get("bothHandsActive"):
        v[7] = 1
    if f.get("rightHandActive"):
        v[8] = 1
    if f.get("leftHandActive"):
        v[9] = 1
    return v


def build_sequence(peak: dict, frames: int = 12) -> list[list[float]]:
    neutral = features_to_vector({})
    target = features_to_vector(peak)
    seq = []
    for i in range(frames):
        t = i / (frames - 1)
        if t < 0.35:
            phase = t / 0.35
        elif t < 0.65:
            phase = 1.0
        else:
            phase = 1.0 - (t - 0.65) / 0.35
        blend = phase * 0.85 + 0.15
        vec = neutral * (1 - blend) + target * blend
        seq.append(vec.tolist())
    return seq


def main() -> None:
    templates = [
        {"word": word, "sequence": build_sequence(peak), "weight": weight}
        for word, peak, weight in PEAKS
    ]
    payload = {
        "version": "1.0",
        "source": "builtin_signTemplates",
        "samples": [],
        "templates": templates,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    print(f"Wrote {len(templates)} templates -> {OUT}")


if __name__ == "__main__":
    main()
