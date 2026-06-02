#!/usr/bin/env python3
"""
Train gloss-sequence CTC model on continuous landmark vectors.

Requires: training/prepare_continuous_gloss.py output.

  python train_gloss_ctc.py --data exports/continuous_gloss.json --output checkpoints/gloss_ctc
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

BLANK = 0


def build_word_vocab(sequences: list[dict]) -> list[str]:
    words = set()
    for seq in sequences:
        for w in seq["gloss"]:
            words.add(w.upper())
    return sorted(words)


def encode_labels(gloss: list[str], word_to_idx: dict[str, int]) -> list[int]:
    return [word_to_idx[w.upper()] + 1 for w in gloss]  # reserve 0 for CTC blank


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="exports/continuous_gloss.json")
    parser.add_argument("--output", default="checkpoints/gloss_ctc")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--max-len", type=int, default=512)
    args = parser.parse_args()

    from tensorflow import keras
    from tensorflow.keras import layers

    with open(args.data, encoding="utf-8") as f:
        payload = json.load(f)
    sequences = payload.get("sequences", [])
    if len(sequences) < 3:
        print("Need >= 3 continuous sequences. Run prepare_continuous_gloss.py after WLASL prep.")
        return

    vocab = build_word_vocab(sequences)
    word_to_idx = {w: i for i, w in enumerate(vocab)}
    num_classes = len(vocab) + 1

    max_len = min(args.max_len, max(s["length"] for s in sequences))
    X, label_seqs = [], []
    for seq in sequences:
        vecs = seq["vectors"][:max_len]
        pad = max_len - len(vecs)
        arr = np.array(vecs, dtype=np.float32)
        if pad > 0:
            arr = np.pad(arr, ((0, pad), (0, 0)))
        X.append(arr)
        label_seqs.append(encode_labels(seq["gloss"], word_to_idx))

    X = np.stack(X)
    max_label_len = max(len(l) for l in label_seqs)

    def pad_labels(labels):
        out = np.zeros((len(labels), max_label_len), dtype=np.int32)
        for i, lab in enumerate(labels):
            out[i, : len(lab)] = lab
        return out

    y = pad_labels(label_seqs)
    label_lengths = np.array([len(l) for l in label_seqs], dtype=np.int32)
    input_lengths = np.full((len(X), 1), max_len // 4, dtype=np.int32)

    inputs = keras.layers.Input(shape=(max_len, 84), name="features")
    x = layers.Masking(mask_value=0.0)(inputs)
    for dilation in (1, 2, 4):
        x = layers.Conv1D(64, 3, padding="same", dilation_rate=dilation, activation="relu")(x)
    x = layers.Dropout(0.25)(x)
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(x)
    x = layers.Conv1D(num_classes, 1, padding="same", activation="softmax")(x)

    model = keras.Model(inputs, x)
    ctc_loss = keras.backend.ctc_batch_cost

    def ctc_lambda(args):
        y_true, y_pred, ilen, tlen = args
        return ctc_loss(y_true, y_pred, ilen, tlen)

    labels = keras.layers.Input(name="labels", shape=(max_label_len,), dtype="int32")
    ilen = keras.layers.Input(name="input_len", shape=(1,), dtype="int32")
    tlen = keras.layers.Input(name="label_len", shape=(1,), dtype="int32")
    loss_out = keras.layers.Lambda(ctc_lambda, output_shape=(1,))([labels, x, ilen, tlen])

    train_model = keras.Model([inputs, labels, ilen, tlen], loss_out)
    train_model.compile(optimizer=keras.optimizers.Adam(1e-3), loss=lambda y, p: p)

    train_model.fit(
        [X, y, input_lengths, label_lengths.reshape(-1, 1)],
        np.zeros((len(X), 1)),
        epochs=args.epochs,
        batch_size=min(8, len(X)),
        verbose=1,
    )

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    model.save(out / "ctc_model.keras")
    with open(out / "vocab.json", "w", encoding="utf-8") as f:
        json.dump({"words": vocab, "blank": BLANK, "maxLen": max_len}, f, indent=2)
    print(f"Saved CTC model -> {out}")
    print("Browser export: future step (use segment classifier + GlossSentenceBuffer for now).")


if __name__ == "__main__":
    main()
