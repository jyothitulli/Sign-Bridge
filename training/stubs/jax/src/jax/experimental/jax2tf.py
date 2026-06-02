"""Stub — JAX->TF conversion is unused by SignBridge training scripts."""

def convert(*_args, **_kwargs):
    raise RuntimeError("JAX export is not available (jax-import-stub installed). Use Keras save_keras_model.")
