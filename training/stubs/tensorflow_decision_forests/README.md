# tensorflow-decision-forests stub

Real [tensorflow-decision-forests](https://github.com/tensorflow/decision-forests) pins TensorFlow ~2.15 and does not install on Python 3.13 with TF 2.20.

tensorflowjs 4.22 imports this package only to support SavedModel conversion for TFDF models. SignBridge uses Keras export only, so an empty stub is sufficient.

Installed automatically by `python training/setup_env.py`.
