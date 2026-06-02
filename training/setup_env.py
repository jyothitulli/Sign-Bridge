#!/usr/bin/env python3
"""
Install training dependencies without tensorflow-decision-forests conflicts.

  python training/setup_env.py

On Python 3.13 (Windows): uses TensorFlow 2.20 + tensorflowjs (--no-deps).
On Python 3.11: can use pinned TF 2.15 stack via --legacy flag.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def pip(*args: str) -> None:
    cmd = [sys.executable, "-m", "pip", "install", *args]
    print(">>", " ".join(cmd))
    subprocess.check_call(cmd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--legacy",
        action="store_true",
        help="Python 3.11 only: tensorflow==2.15.1 + tensorflowjs==4.17.0",
    )
    args = parser.parse_args()

    pip("-r", str(ROOT / "requirements-core.txt"))

    if args.legacy:
        pip("tensorflow==2.15.1", "tensorflowjs==4.17.0")
        print("\nLegacy stack installed (Python 3.11 recommended).")
        return

    # Python 3.12/3.13: avoid tensorflow-decision-forests pin conflict
    pip("tensorflow==2.20.0")
    pip("tf-keras==2.20.0")
    # tensorflowjs imports tensorflow_decision_forests; real TFDF pins TF 2.15 (fails on Py 3.13)
    stub = ROOT / "stubs" / "tensorflow_decision_forests"
    pip(str(stub))
    pip("tensorflowjs==4.22.0", "--no-deps")
    # Runtime deps omitted by --no-deps (Keras + SavedModel import chain)
    pip("packaging", "six", "h5py", "tensorflow-hub", "setuptools<81", "importlib_resources>=5.9.0")
    _install_jax_or_stub(ROOT)

    print("\nTraining environment ready.")
    print('Verify: python -c "import tensorflow; import tensorflowjs; print(\'OK\', tensorflow.__version__)"')


def _install_jax_or_stub(root: Path) -> None:
    """tensorflowjs imports jax at load time; Keras training does not need real JAX."""
    try:
        pip("jax>=0.4.13", "jaxlib>=0.4.13", "flax>=0.7.2")
    except subprocess.CalledProcessError:
        print("\nNote: jax/flax install failed (common on Windows long paths). Using import stub.")
        pip(str(root / "stubs" / "jax"))


if __name__ == "__main__":
    main()
