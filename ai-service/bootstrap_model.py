"""
Creates models/dr_model.keras with the SAME architecture train.py builds,
using ImageNet weights for the EfficientNetB0 backbone and an untrained
classification head.

Why this exists
---------------
app.py loads a saved model at import time. The trained model is not in git
(see .gitignore), so without this the whole pipeline cannot be started until
someone downloads the APTOS dataset and trains for hours.

This bootstrap makes the pipeline runnable end to end. The predictions are
NOT clinically meaningful until train.py has been run on the real dataset -
the head is randomly initialised, so it outputs near-uniform probabilities.

Usage:
    python bootstrap_model.py            # will not overwrite a trained model
    python bootstrap_model.py --force    # overwrite
"""

import argparse
import json
import os

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0

IMG_SIZE = 224
NUM_CLASSES = 5

MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "dr_model.keras")
MARKER_PATH = os.path.join(MODEL_DIR, "model_info.json")


def build_model():
    """Identical layer graph to train.py, so layer names match app.py."""

    data_augmentation = tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.05),
            layers.RandomZoom(0.10),
            layers.RandomContrast(0.10),
        ]
    )

    base_model = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
    )

    base_model.trainable = False

    inputs = tf.keras.Input(
        shape=(IMG_SIZE, IMG_SIZE, 3)
    )

    x = data_augmentation(inputs)

    x = base_model(x, training=False)

    x = layers.GlobalAveragePooling2D()(x)

    x = layers.Dropout(0.30)(x)

    outputs = layers.Dense(
        NUM_CLASSES,
        activation="softmax",
    )(x)

    model = tf.keras.Model(inputs, outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing model file.",
    )

    args = parser.parse_args()

    os.makedirs(MODEL_DIR, exist_ok=True)

    if os.path.exists(MODEL_PATH) and not args.force:
        print(f"{MODEL_PATH} already exists. Use --force to overwrite.")
        return

    print("Building EfficientNetB0 + classification head...")

    model = build_model()

    model.save(MODEL_PATH)

    with open(MARKER_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "trained": False,
                "source": "bootstrap_model.py",
                "backbone": "EfficientNetB0 (imagenet)",
                "head": "randomly initialised - predictions are placeholders",
                "next_step": "python prepare_dataset.py && python train.py",
            },
            handle,
            indent=2,
        )

    print()
    print(f"Saved {MODEL_PATH}")
    print("Layer names:", [layer.name for layer in model.layers])
    print()
    print("NOTE: the classification head is UNTRAINED.")
    print("Run prepare_dataset.py and train.py on the real dataset")
    print("before using any prediction clinically.")


if __name__ == "__main__":
    main()
