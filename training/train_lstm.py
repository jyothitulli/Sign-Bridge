#!/usr/bin/env python3
"""
SignBridge LSTM Training — real-world accuracy path
===================================================
Uses 84-dim shoulder-normalized hand vectors (same as DTW + browser inference).

  pip install -r requirements.txt
  python train_lstm.py --data exports/merged.json --output ../public/models/lstm
  python evaluate_model.py --data exports/merged.json --model ../public/models/lstm
"""

import argparse
import json
import os
import random

import numpy as np

from feature_extract import (
    LSTM_FEATURES,
    LSTM_TIMESTEPS,
    augment_matrix,
    frames_to_lstm_matrix,
    template_sequence_to_matrix,
)


def load_samples(path: str):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    samples = data.get("samples", [])
    templates = data.get("templates", [])
    print(f"Loaded {len(samples)} samples, {len(templates)} templates")
    return samples, templates


def build_vocabulary(samples, templates, min_samples=3):
    counts: dict[str, int] = {}
    for sample in samples:
        word = sample.get("word", "").split("_")[0].upper()
        if word:
            counts[word] = counts.get(word, 0) + 1
    for tpl in templates:
        word = tpl.get("word", "").upper()
        if word:
            counts[word] = counts.get(word, 0) + 1

    vocab = sorted(w for w, c in counts.items() if c >= min_samples)
    if not vocab:
        vocab = sorted(counts.keys())
    return vocab, counts


def build_dataset(samples, templates, vocabulary, augment_factor=3):
    X, y = [], []
    word_to_idx = {w: i for i, w in enumerate(vocabulary)}

    def add_example(matrix, word, do_augment=False):
        if word not in word_to_idx:
            return
        label = np.zeros(len(vocabulary), dtype=np.float32)
        label[word_to_idx[word]] = 1.0
        X.append(matrix)
        y.append(label)
        if do_augment:
            for _ in range(augment_factor - 1):
                X.append(augment_matrix(matrix))
                y.append(label.copy())

    for sample in samples:
        word = sample.get("word", "").split("_")[0].upper()
        frames = sample.get("frames", [])
        if not frames:
            continue
        matrix = frames_to_lstm_matrix(frames)
        add_example(matrix, word, do_augment=True)

    for tpl in templates:
        word = tpl.get("word", "").upper()
        seq = tpl.get("sequence", [])
        if not seq:
            continue
        matrix = template_sequence_to_matrix(seq)
        add_example(matrix, word, do_augment=True)

    if not X:
        raise ValueError(
            "No training data. Record signs in /collect or /practice, export JSON, then retry."
        )

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def stratified_split(X, y, val_ratio=0.15, seed=42):
    rng = random.Random(seed)
    by_class: dict[int, list[int]] = {}
    for i, label in enumerate(y):
        cls = int(np.argmax(label))
        by_class.setdefault(cls, []).append(i)

    train_idx, val_idx = [], []
    for indices in by_class.values():
        rng.shuffle(indices)
        n_val = max(1, int(len(indices) * val_ratio)) if len(indices) >= 4 else 1
        val_idx.extend(indices[:n_val])
        train_idx.extend(indices[n_val:])

    if not train_idx:
        train_idx = val_idx
        val_idx = val_idx[: max(1, len(val_idx) // 5)]

    return X[train_idx], y[train_idx], X[val_idx], y[val_idx]


def main():
    parser = argparse.ArgumentParser(description="Train SignBridge LSTM")
    parser.add_argument("--data", required=True, help="Exported or merged JSON")
    parser.add_argument("--output", default="../public/models/lstm")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--min-samples", type=int, default=3, help="Min clips per word to include in vocab")
    parser.add_argument("--augment", type=int, default=3, help="Augmented copies per real sample")
    args = parser.parse_args()

    import tensorflow as tf
    from tensorflow import keras
    from tensorflowjs import converters

    samples, templates = load_samples(args.data)
    vocabulary, counts = build_vocabulary(samples, templates, args.min_samples)
    print(f"Vocabulary ({len(vocabulary)} words):", ", ".join(vocabulary))
    for w in vocabulary:
        print(f"  {w}: {counts.get(w, 0)} clips")

    X, y = build_dataset(samples, templates, vocabulary, augment_factor=args.augment)
    X_train, y_train, X_val, y_val = stratified_split(X, y)
    print(f"Training: {X_train.shape[0]} | Validation: {X_val.shape[0]}")

    model = keras.Sequential([
        keras.layers.Input(shape=(LSTM_TIMESTEPS, LSTM_FEATURES)),
        keras.layers.Masking(mask_value=0.0),
        keras.layers.LSTM(96, return_sequences=True),
        keras.layers.Dropout(0.35),
        keras.layers.LSTM(48),
        keras.layers.Dropout(0.25),
        keras.layers.Dense(len(vocabulary), activation="softmax"),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0008),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True, monitor="val_accuracy"),
        keras.callbacks.ReduceLROnPlateau(patience=4, factor=0.5, min_lr=1e-5),
    ]

    model.fit(
        X_train,
        y_train,
        epochs=args.epochs,
        batch_size=min(16, max(4, len(X_train) // 8)),
        validation_data=(X_val, y_val),
        callbacks=callbacks,
        verbose=1,
    )

    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"\nValidation accuracy: {val_acc * 100:.1f}%")

    os.makedirs(args.output, exist_ok=True)

    config = {
        "version": "2.0.0",
        "timesteps": LSTM_TIMESTEPS,
        "features": LSTM_FEATURES,
        "featureSpec": "handVector84-shoulder-normalized",
        "description": "Trained LSTM — per-segment word classification",
        "vocabulary": vocabulary,
        "training": {
            "samples": len(samples),
            "templates": len(templates),
            "valAccuracy": round(float(val_acc), 4),
            "inputShape": [LSTM_TIMESTEPS, LSTM_FEATURES],
        },
    }
    with open(os.path.join(args.output, "config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    converters.save_keras_model(model, args.output)
    print(f"Model + config saved to {args.output}")
    print("Restart the app — Translate badge should show LSTM.")


if __name__ == "__main__":
    main()
