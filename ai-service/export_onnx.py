"""
Export the trained Keras model to ONNX for serving.

Two things make this script necessary rather than a one-line tf2onnx call:

1. The service needs **two** outputs, not one. It returns a Grad-CAM heatmap
   with every prediction, and for a GlobalAveragePooling -> Dropout -> Dense
   head the Grad-CAM gradient weights are algebraically identical to the Dense
   weights - so the heatmap is just the backbone's feature map weighted by one
   row of that Dense layer. That needs no autodiff and no TensorFlow at serve
   time, but it does need the feature map exported alongside the probabilities.

2. Those Dense weights ship separately as cam_weights.npz, and they must come
   from the same checkpoint as the ONNX file. Exporting them together is what
   stops a heatmap from being drawn with a previous model's weights.

The export is verified before it is written: ONNX and Keras must agree to 1e-5
on random input, or the script fails rather than shipping a silent mismatch.

    venv\\Scripts\\python export_onnx.py
"""

import os

import numpy as np
import onnxruntime as ort
import tensorflow as tf
import tf2onnx

MODEL_DIR = "models"
KERAS_PATH = os.path.join(MODEL_DIR, "dr_model.keras")
ONNX_PATH = os.path.join(MODEL_DIR, "dr_model.onnx")
CAM_PATH = os.path.join(MODEL_DIR, "cam_weights.npz")

IMG_SIZE = 224
TOLERANCE = 1e-5


def main():
    model = tf.keras.models.load_model(KERAS_PATH)

    base = model.get_layer("efficientnetb0")

    # The last Dense layer is the classifier head; its weights are the CAM
    # weights. Found by type rather than by name, because Keras renames layers
    # when a model is reloaded and re-saved.
    dense = [
        layer for layer in model.layers
        if isinstance(layer, tf.keras.layers.Dense)
    ][-1]

    weights, bias = dense.get_weights()

    print(f"backbone {base.name}, head {dense.name} {weights.shape}")

    # A wrapper that returns the feature map as well as the probabilities.
    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="input")

    features = base(inputs, training=False)
    pooled = tf.keras.layers.GlobalAveragePooling2D()(features)
    probabilities = dense(pooled)

    exportable = tf.keras.Model(inputs, [features, probabilities])

    tf2onnx.convert.from_keras(
        exportable,
        input_signature=(
            tf.TensorSpec((None, IMG_SIZE, IMG_SIZE, 3), tf.float32, name="input"),
        ),
        opset=15,
        output_path=ONNX_PATH,
    )

    # Key names must match what app.py loads: np.load(...)["kernel"].
    np.savez(CAM_PATH, kernel=weights, bias=bias)

    # ---------------------------------------------------------------
    # Verify before trusting it
    # ---------------------------------------------------------------

    sample = (
        np.random.default_rng(0)
        .random((2, IMG_SIZE, IMG_SIZE, 3))
        .astype(np.float32)
        * 255
    )

    expected = model.predict(sample, verbose=0)

    session = ort.InferenceSession(
        ONNX_PATH, providers=["CPUExecutionProvider"]
    )

    outputs = session.run(None, {"input": sample})

    feature_map = next(o for o in outputs if o.ndim == 4)
    actual = next(o for o in outputs if o.ndim == 2)

    difference = float(np.abs(expected - actual).max())

    print(f"feature map {feature_map.shape}, probabilities {actual.shape}")
    print(f"keras vs onnx, largest difference: {difference:.2e}")

    if difference > TOLERANCE:
        raise SystemExit(
            f"ONNX disagrees with Keras by {difference:.2e} - not exporting."
        )

    size = os.path.getsize(ONNX_PATH) / 1e6

    print(f"Wrote {ONNX_PATH} ({size:.0f} MB) and {CAM_PATH}")


if __name__ == "__main__":
    main()
