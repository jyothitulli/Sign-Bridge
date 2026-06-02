#!/usr/bin/env python3
"""
Export a trained Keras model to quantized TensorFlow.js for mobile browsers.

  python export_tfjs_quantized.py --keras-dir ../public/models/lstm --output ../public/models/lstm
  python export_tfjs_quantized.py --saved-model ./saved_model --output ../public/models/lstm --quantize uint8
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile


def export_from_keras(model_dir: str, output_dir: str, quantize: str):
    from tensorflow import keras
    from tensorflowjs import converters

    keras_path = os.path.join(model_dir, "model.json")
    if not os.path.isfile(keras_path):
        raise FileNotFoundError(f"No Keras model at {keras_path} — train with train_tcn.py first")

    model = keras.models.load_model(model_dir)
    os.makedirs(output_dir, exist_ok=True)

    config_src = os.path.join(model_dir, "config.json")
    if os.path.isfile(config_src) and model_dir != output_dir:
        shutil.copy(config_src, os.path.join(output_dir, "config.json"))

    kwargs = {}
    if quantize == "uint8":
        kwargs["quantization_dtype"] = "uint8"
    elif quantize == "float16":
        kwargs["quantization_dtype"] = "float16"

    with tempfile.TemporaryDirectory() as tmp:
        converters.save_keras_model(model, tmp, **kwargs)
        for name in os.listdir(tmp):
            src = os.path.join(tmp, name)
            dst = os.path.join(output_dir, name)
            if os.path.isfile(dst) and name != "model.json":
                os.remove(dst)
            shutil.copy2(src, dst)

    print(f"Exported {quantize} quantized TF.js model → {output_dir}")


def export_from_saved_model(saved_model_dir: str, output_dir: str, quantize: str):
    import subprocess

    os.makedirs(output_dir, exist_ok=True)
    cmd = [
        "tensorflowjs_converter",
        "--input_format=tf_saved_model",
        f"--quantize_{quantize}",
        saved_model_dir,
        output_dir,
    ]
    subprocess.run(cmd, check=True)
    print(f"Exported SavedModel → {output_dir}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keras-dir", help="Directory with keras model.json")
    parser.add_argument("--saved-model", help="TF SavedModel directory")
    parser.add_argument("--output", default="../public/models/lstm")
    parser.add_argument(
        "--quantize",
        choices=("uint8", "float16", "none"),
        default="uint8",
    )
    args = parser.parse_args()

    if args.quantize == "none":
        quantize = "float16"  # fallback minimal
    else:
        quantize = args.quantize

    if args.keras_dir:
        export_from_keras(args.keras_dir, args.output, quantize)
    elif args.saved_model:
        export_from_saved_model(args.saved_model, args.output, quantize)
    else:
        raise SystemExit("Provide --keras-dir or --saved-model")

    config_path = os.path.join(args.output, "config.json")
    if os.path.isfile(config_path):
        with open(config_path, encoding="utf-8") as f:
            cfg = json.load(f)
        cfg["quantized"] = args.quantize
        cfg["tfjsExport"] = True
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)


if __name__ == "__main__":
    main()
