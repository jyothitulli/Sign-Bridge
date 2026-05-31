#!/usr/bin/env python3
"""
Extract 84-dim normalized hand vectors from serialized SignBridge frames.
Must stay in sync with src/utils/handVector.ts and src/utils/lstmFeatures.ts.
"""

import numpy as np

HAND_LANDMARK_COUNT = 21
HAND_VECTOR_DIM = 84
LSTM_TIMESTEPS = 30
LSTM_FEATURES = HAND_VECTOR_DIM


def _unflat(arr, count=21):
    pts = []
    for i in range(0, min(len(arr), count * 3), 3):
        pts.append({"x": arr[i], "y": arr[i + 1], "z": arr[i + 2]})
    return pts


def _get_body_frame(pose):
    if not pose or len(pose) < 13:
        return None
    ls = pose[11]
    rs = pose[12]
    if not ls or not rs:
        return None
    center_x = (ls["x"] + rs["x"]) / 2
    shoulder_y = (ls["y"] + rs["y"]) / 2
    scale = max(abs(rs["x"] - ls["x"]), 0.12)
    return center_x, shoulder_y, scale


def _normalize_point(p, body):
    cx, sy, scale = body
    return (p["x"] - cx) / scale, (p["y"] - sy) / scale


def frame_to_hand_vector(frame) -> np.ndarray:
    """84-dim vector: left hand xy (42) + right hand xy (42), shoulder-normalized."""
    pose = _unflat(frame.get("pose", []), 33)
    body = _get_body_frame(pose)
    if body is None:
        return np.zeros(HAND_VECTOR_DIM, dtype=np.float32)

    v = np.zeros(HAND_VECTOR_DIM, dtype=np.float32)
    idx = 0
    for key in ("leftHand", "rightHand"):
        hand = _unflat(frame.get(key, []), 21)
        if len(hand) >= HAND_LANDMARK_COUNT:
            for i in range(HAND_LANDMARK_COUNT):
                nx, ny = _normalize_point(hand[i], body)
                v[idx] = nx
                v[idx + 1] = ny
                idx += 2
        else:
            idx += HAND_LANDMARK_COUNT * 2
    return v


def resample_sequence(vectors: list, target_len: int) -> np.ndarray:
    if not vectors:
        return np.zeros((target_len, HAND_VECTOR_DIM), dtype=np.float32)
    if len(vectors) == 1:
        return np.tile(vectors[0], (target_len, 1))

    n = len(vectors)
    out = np.zeros((target_len, vectors[0].shape[0]), dtype=np.float32)
    for t in range(target_len):
        pos = (t / (target_len - 1)) * (n - 1)
        i0 = int(np.floor(pos))
        i1 = min(i0 + 1, n - 1)
        frac = pos - i0
        out[t] = vectors[i0] * (1 - frac) + vectors[i1] * frac
    return out


def frames_to_lstm_matrix(frames_flat, timesteps=LSTM_TIMESTEPS) -> np.ndarray:
    vectors = [frame_to_hand_vector(f) for f in frames_flat]
    return resample_sequence(vectors, timesteps)


def template_sequence_to_matrix(sequence, timesteps=LSTM_TIMESTEPS) -> np.ndarray:
    """User templates store 12-frame 84-dim sequences from the browser."""
    if not sequence:
        return np.zeros((timesteps, HAND_VECTOR_DIM), dtype=np.float32)
    arr = np.array(sequence, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    return resample_sequence(list(arr), timesteps)


def augment_matrix(x: np.ndarray, noise=0.02, scale_range=(0.92, 1.08)) -> np.ndarray:
    """Light augmentation for small datasets."""
    out = x.copy()
    scale = np.random.uniform(*scale_range)
    out *= scale
    out += np.random.normal(0, noise, out.shape).astype(np.float32)
    return out
