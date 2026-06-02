#!/usr/bin/env python3
"""
SignBridge TCN Training — temporal conv net on 84-dim hand vectors.
Same data contract as train_lstm.py; outputs compatible TF.js bundle.

  python train_tcn.py --data exports/merged.json --output ../public/models/lstm
"""

from __future__ import annotations

import argparse
import json
import os

import numpy as np

from feature_extract import LSTM_FEATURES, LSTM_TIMESTEPS
from train_lstm import (
    build_dataset,
    build_vocabulary,
    load_samples,
    stratified_split,
)


def build_tcn_model(timesteps: int, features: int, num_classes: int):
    from keras_backend import keras, layers

    inputs = layers.Input(shape=(timesteps, features))
    x = inputs

    for dilation in (1, 2, 4, 8):
        residual = x
        x = layers.Conv1D(
            64,
            kernel_size=3,
            padding="same",
            dilation_rate=dilation,
            activation="relu",
        )(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.2)(x)
        if residual.shape[-1] == 64:
            x = layers.Add()([residual, x])

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return keras.Model(inputs, outputs)


def main():
    parser = argparse.ArgumentParser(description="Train SignBridge TCN word classifier")
    parser.add_argument("--data", required=True, help="Exported or merged JSON")
    parser.add_argument("--output", default="../public/models/lstm")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--min-samples", type=int, default=3)
    parser.add_argument("--augment", type=int, default=3)
    args = parser.parse_args()

    from keras_backend import keras
    from tensorflowjs import converters

    samples, templates = load_samples(args.data)
    vocabulary, counts = build_vocabulary(samples, templates, args.min_samples)
    print(f"Vocabulary ({len(vocabulary)} words):", ", ".join(vocabulary))
    for w in vocabulary:
        print(f"  {w}: {counts.get(w, 0)} clips")

    X, y = build_dataset(samples, templates, vocabulary, augment_factor=args.augment)
    X_train, y_train, X_val, y_val = stratified_split(X, y)
    print(f"Training: {X_train.shape[0]} | Validation: {X_val.shape[0]}")

    model = build_tcn_model(LSTM_TIMESTEPS, LSTM_FEATURES, len(vocabulary))
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True, monitor="val_accuracy"),
        keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5, min_lr=1e-5),
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
        "version": "3.0.0",
        "architecture": "tcn",
        "timesteps": LSTM_TIMESTEPS,
        "features": LSTM_FEATURES,
        "featureSpec": "handVector84-shoulder-normalized",
        "description": "Trained TCN — per-segment word classification",
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
    print(f"TCN model + config saved to {args.output}")


if __name__ == "__main__":
    main()
