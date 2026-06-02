"""
Keras 2 / tf_keras backend for TF.js-compatible exports.

Keras 3 (bundled with TF 2.21+) produces model.json that the browser TF.js
loader cannot parse. Use tf_keras 2.20 + legacy flag before training.
"""

from __future__ import annotations

import os

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import tf_keras as keras  # noqa: E402
from tf_keras import layers  # noqa: E402

__all__ = ["keras", "layers"]
