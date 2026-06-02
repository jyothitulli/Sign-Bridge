# jax import stub

tensorflowjs 4.22 imports `jax.experimental.jax2tf` at load time. SignBridge only uses Keras export (`save_keras_model`), not JAX conversion.

If `pip install jax` fails on Windows (long path errors), `setup_env.py` installs this stub instead so training still works.
