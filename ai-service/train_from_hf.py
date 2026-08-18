"""
Trains the diabetic retinopathy classifier on the open dataset
`youssefedweqd/Diabetic_Retinopathy_Detection` (MIT licence), downloaded as
parquet into data/hf/.

Why it is split into two phases
-------------------------------
The backbone is frozen, exactly as in train.py, so every image produces the
same 1280-dim embedding on every epoch. Computing those once and then fitting
only the classification head turns hours of CPU backpropagation into seconds
per epoch, and lets the head see many more epochs than a GPU-less machine
could otherwise afford.

  phase 1   decode -> 224x224 -> EfficientNetB0 -> cache embeddings to .npy
  phase 2   fit the Dense(5) head on those embeddings, with class weights

The saved model keeps the exact layer names app.py expects
(efficientnetb0 / global_average_pooling2d / dropout / dense), so the service
picks it up with no code change.

About the metrics
-----------------
73.5% of this dataset is grade 0. A model that answers "No DR" every time
scores 73.5% accuracy and catches no disease at all, so accuracy alone is
reported next to quadratic weighted kappa and per-class recall, which are the
numbers that actually move when the model learns something.

Usage:
    venv\\Scripts\\python train_from_hf.py                 # both phases
    venv\\Scripts\\python train_from_hf.py --features-only
    venv\\Scripts\\python train_from_hf.py --epochs 200
"""

import argparse
import glob
import json
import os
import time

import cv2
import numpy as np
import pyarrow.parquet as pq
import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0

IMG_SIZE = 224
NUM_CLASSES = 5
BATCH = 64

DATA_DIR = os.path.join("data", "hf")
FEATURE_DIR = os.path.join("data", "features")
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "dr_model.keras")
MARKER_PATH = os.path.join(MODEL_DIR, "model_info.json")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.json")

CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

SPLITS = {
    "train": "train-*.parquet",
    "validation": "validation-*.parquet",
    "test": "test-*.parquet",
}


# ============================================================
# PHASE 1 - EMBEDDINGS
# ============================================================


def build_backbone():

    base = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
    )

    base.trainable = False

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))

    outputs = layers.GlobalAveragePooling2D()(
        base(inputs, training=False)
    )

    return tf.keras.Model(inputs, outputs), base


def decode(record_bytes):
    """Parquet stores the raw encoded image; EfficientNet wants 0-255 RGB."""

    buffer = np.frombuffer(record_bytes, dtype=np.uint8)

    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)

    if image is None:
        return None

    image = cv2.resize(image, (IMG_SIZE, IMG_SIZE))

    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB).astype(np.float32)


def extract_split(name, pattern, encoder):

    features_path = os.path.join(FEATURE_DIR, f"{name}_x.npy")
    labels_path = os.path.join(FEATURE_DIR, f"{name}_y.npy")

    if os.path.exists(features_path) and os.path.exists(labels_path):
        print(f"  {name}: cached")
        return np.load(features_path), np.load(labels_path)

    files = sorted(glob.glob(os.path.join(DATA_DIR, pattern)))

    if not files:
        raise SystemExit(
            f"No parquet files for {name} in {DATA_DIR}."
        )

    all_features = []
    all_labels = []

    started = time.perf_counter()
    done = 0

    for path in files:

        parquet = pq.ParquetFile(path)

        for batch in parquet.iter_batches(batch_size=BATCH):

            images = batch.column("image").to_pylist()
            labels = batch.column("label").to_pylist()

            decoded = []
            kept = []

            for index, record in enumerate(images):

                image = decode(record["bytes"])

                if image is None:
                    continue

                decoded.append(image)
                kept.append(labels[index])

            if not decoded:
                continue

            features = encoder.predict(
                np.stack(decoded),
                verbose=0,
            )

            all_features.append(features)
            all_labels.extend(kept)

            done += len(decoded)

            if done % (BATCH * 20) == 0:
                rate = done / (time.perf_counter() - started)
                print(
                    f"  {name}: {done} images "
                    f"({rate:.0f}/s)",
                    flush=True,
                )

    features = np.concatenate(all_features).astype(np.float32)
    labels = np.asarray(all_labels, dtype=np.int64)

    os.makedirs(FEATURE_DIR, exist_ok=True)

    np.save(features_path, features)
    np.save(labels_path, labels)

    print(
        f"  {name}: {len(labels)} images in "
        f"{time.perf_counter() - started:.0f}s -> {features.shape}"
    )

    return features, labels


# ============================================================
# PHASE 2 - HEAD
# ============================================================


def quadratic_weighted_kappa(true, predicted, classes=NUM_CLASSES):
    """
    The standard metric for retinopathy grading: it rewards being close on an
    ordered scale, so calling a grade 4 a grade 3 costs far less than calling
    it a grade 0.
    """

    confusion = np.zeros((classes, classes), dtype=float)

    for actual, guess in zip(true, predicted):
        confusion[actual, guess] += 1

    weights = np.zeros((classes, classes), dtype=float)

    for row in range(classes):
        for column in range(classes):
            weights[row, column] = ((row - column) ** 2) / ((classes - 1) ** 2)

    actual_hist = np.bincount(true, minlength=classes).astype(float)
    guess_hist = np.bincount(predicted, minlength=classes).astype(float)

    expected = np.outer(actual_hist, guess_hist)
    expected = expected / expected.sum() * confusion.sum()

    denominator = (weights * expected).sum()

    if denominator == 0:
        return 0.0

    return float(1.0 - (weights * confusion).sum() / denominator)


def report(name, true, probabilities):

    predicted = probabilities.argmax(axis=1)

    accuracy = float((predicted == true).mean())
    kappa = quadratic_weighted_kappa(true, predicted)

    print(f"\n{name}")
    print("-" * 66)
    print(f"  accuracy                     {accuracy * 100:.2f}%")
    print(f"  quadratic weighted kappa     {kappa:.4f}")

    # Referable retinopathy - grade 2 or worse - is the decision that matters
    # clinically, so it gets its own sensitivity and specificity.
    referable_true = true >= 2
    referable_pred = predicted >= 2

    true_positive = int((referable_true & referable_pred).sum())
    false_negative = int((referable_true & ~referable_pred).sum())
    true_negative = int((~referable_true & ~referable_pred).sum())
    false_positive = int((~referable_true & referable_pred).sum())

    sensitivity = (
        true_positive / (true_positive + false_negative)
        if true_positive + false_negative
        else 0.0
    )

    specificity = (
        true_negative / (true_negative + false_positive)
        if true_negative + false_positive
        else 0.0
    )

    print(
        f"  referable (grade>=2) sens    {sensitivity * 100:.1f}%   "
        f"spec {specificity * 100:.1f}%"
    )

    print("\n  per class:")

    per_class = {}

    for index, label in enumerate(CLASS_NAMES):

        mask = true == index
        support = int(mask.sum())

        recall = float((predicted[mask] == index).mean()) if support else 0.0

        chosen = predicted == index

        precision = (
            float((true[chosen] == index).mean())
            if chosen.sum()
            else 0.0
        )

        per_class[label] = {
            "recall": round(recall, 4),
            "precision": round(precision, 4),
            "support": support,
        }

        print(
            f"    {index} {label:<14} recall {recall * 100:5.1f}%   "
            f"precision {precision * 100:5.1f}%   n={support}"
        )

    confusion = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=int)

    for actual, guess in zip(true, predicted):
        confusion[actual, guess] += 1

    print("\n  confusion (rows = truth, columns = prediction):")

    for index, row in enumerate(confusion):
        print(f"    {index}  " + "  ".join(f"{value:>5}" for value in row))

    return {
        "accuracy": round(accuracy, 4),
        "quadraticWeightedKappa": round(kappa, 4),
        "referableSensitivity": round(sensitivity, 4),
        "referableSpecificity": round(specificity, 4),
        "perClass": per_class,
        "confusion": confusion.tolist(),
    }


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument("--features-only", action="store_true")
    parser.add_argument("--epochs", type=int, default=120)

    arguments = parser.parse_args()

    os.makedirs(FEATURE_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)

    print("Phase 1: embeddings from the frozen backbone")

    encoder, base = build_backbone()

    data = {}

    for name, pattern in SPLITS.items():
        data[name] = extract_split(name, pattern, encoder)

    if arguments.features_only:
        return

    train_x, train_y = data["train"]
    val_x, val_y = data["validation"]
    test_x, test_y = data["test"]

    print("\nPhase 2: classification head")

    # Balanced class weights, otherwise the head learns to answer "No DR" for
    # everything and still scores 73.5%.
    counts = np.bincount(train_y, minlength=NUM_CLASSES).astype(float)

    weights = counts.sum() / (NUM_CLASSES * np.maximum(counts, 1))

    class_weight = {index: float(value) for index, value in enumerate(weights)}

    print("  class weights:", {
        CLASS_NAMES[index]: round(value, 2)
        for index, value in class_weight.items()
    })

    # The head must stay Dense(5) on pooled features so the saved model keeps
    # the architecture app.py already knows.
    head_input = tf.keras.Input(shape=(train_x.shape[1],))

    head_output = layers.Dense(
        NUM_CLASSES,
        activation="softmax",
    )(layers.Dropout(0.30)(head_input))

    head = tf.keras.Model(head_input, head_output)

    head.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    head.fit(
        train_x,
        train_y,
        validation_data=(val_x, val_y),
        epochs=arguments.epochs,
        batch_size=256,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=12,
                restore_best_weights=True,
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss",
                factor=0.5,
                patience=5,
                min_lr=1e-5,
            ),
        ],
        verbose=2,
    )

    validation_metrics = report(
        "VALIDATION",
        val_y,
        head.predict(val_x, verbose=0),
    )

    test_metrics = report(
        "TEST (held out)",
        test_y,
        head.predict(test_x, verbose=0),
    )

    # ------------------------------------------------------------
    # Reassemble the full model in the shape the service expects
    # ------------------------------------------------------------

    augmentation = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.05),
        layers.RandomZoom(0.10),
        layers.RandomContrast(0.10),
    ])

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))

    # Names are pinned. Keras uniquifies auto-generated names against every
    # layer already built in this process, so the head fitted above would
    # otherwise push these to dense_1 / dropout_1 and app.py, which looks them
    # up by name, would not find them.
    x = augmentation(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D(
        name="global_average_pooling2d"
    )(x)
    x = layers.Dropout(0.30, name="dropout")(x)

    outputs = layers.Dense(
        NUM_CLASSES,
        activation="softmax",
        name="dense",
    )(x)

    model = tf.keras.Model(inputs, outputs)

    # Copy the trained head across.
    model.get_layer("dense").set_weights(
        head.get_layer("dense").get_weights()
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    model.save(MODEL_PATH)

    print(f"\nSaved {MODEL_PATH}")
    print("layers:", [layer.name for layer in model.layers])

    # The service reads this to decide whether to warn about placeholder
    # weights; a trained model no longer needs the warning.
    if os.path.exists(MARKER_PATH):
        os.remove(MARKER_PATH)

    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "dataset": "youssefedweqd/Diabetic_Retinopathy_Detection (MIT)",
                "trainImages": int(len(train_y)),
                "validationImages": int(len(val_y)),
                "testImages": int(len(test_y)),
                "backbone": "EfficientNetB0 imagenet, frozen",
                "head": "Dropout(0.30) + Dense(5, softmax), balanced class weights",
                "validation": validation_metrics,
                "test": test_metrics,
            },
            handle,
            indent=2,
        )

    print(f"Saved {REPORT_PATH}")


if __name__ == "__main__":
    main()
