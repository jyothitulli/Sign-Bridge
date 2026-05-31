#!/usr/bin/env python3
"""Evaluate a trained SignBridge LSTM on held-out clips."""

import argparse
import json
import os

import numpy as np

from feature_extract import LSTM_FEATURES, LSTM_TIMESTEPS
from train_lstm import build_dataset, stratified_split


def load_tfjs_model(model_dir):
    import tensorflow as tf
    from tensorflowjs.converters import load_keras_model

    model_path = os.path.join(model_dir, "model.json")
    return load_keras_model(model_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--model", default="../public/models/lstm")
    args = parser.parse_args()

    config_path = os.path.join(args.model, "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if config.get("features") != LSTM_FEATURES or config.get("timesteps") != LSTM_TIMESTEPS:
        print("Warning: config shape differs from current feature spec — retrain recommended.")

    vocabulary = config["vocabulary"]
    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)

    X, y = build_dataset(data.get("samples", []), data.get("templates", []), vocabulary, augment_factor=1)
    _, _, X_val, y_val = stratified_split(X, y)

    model = load_tfjs_model(args.model)
    preds = model.predict(X_val, verbose=0)
    pred_idx = np.argmax(preds, axis=1)
    true_idx = np.argmax(y_val, axis=1)

    acc = np.mean(pred_idx == true_idx)
    print(f"Top-1 accuracy: {acc * 100:.1f}% ({len(X_val)} validation clips)")

    print("\nPer-word accuracy:")
    for i, word in enumerate(vocabulary):
        mask = true_idx == i
        if not np.any(mask):
            continue
        word_acc = np.mean(pred_idx[mask] == i)
        print(f"  {word:12} {word_acc * 100:5.1f}%  ({int(mask.sum())} clips)")


if __name__ == "__main__":
    main()
