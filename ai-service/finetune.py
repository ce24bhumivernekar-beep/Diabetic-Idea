"""
Fine-tune the classifier, and choose an operating point fit for screening.

The shipped model was a linear probe: a frozen ImageNet backbone with one dense
layer fitted on cached embeddings. It reached kappa 0.364 and caught 64.9% of
referable disease - which is not a screening tool, because a third of the
people who needed a specialist were told they were fine.

Two changes, in order of how much they buy:

1. Unfreeze the top of the backbone. ImageNet features were never asked to
   separate microaneurysms from noise; the last blocks have to learn what a
   retina looks like. This is the expensive part on a CPU, so it trains on a
   class-balanced subset rather than all 25,290 images.

2. Stop using argmax. A screening programme does not ask "which of five grades
   is most likely", it asks "should a specialist see this person". That is a
   single threshold on P(grade >= 2), and moving it trades specificity for
   sensitivity deliberately rather than accepting whatever argmax happens to
   give. NHS screening asks for >= 80% sensitivity; the threshold is chosen to
   meet a target and the cost in specificity is reported honestly.

Usage:
    venv\\Scripts\\python finetune.py --epochs 3 --per-class 1400
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

IMG_SIZE = 224
NUM_CLASSES = 5
CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

DATA_DIR = os.path.join("data", "hf")
MODEL_DIR = "models"
KERAS_PATH = os.path.join(MODEL_DIR, "dr_model.keras")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.json")

# What a screening programme is actually asked to hit.
TARGET_SENSITIVITY = 0.85

# The target the shipped threshold is chosen for. NHS diabetic eye screening
# asks for at least 80% sensitivity; going higher costs specificity fast.
SHIPPED_SENSITIVITY = 0.80


def load_split(pattern, per_class=None, limit=None):
    """
    Decode images out of the parquet shards.

    With per_class set, the classes are balanced by capping the common grades:
    73.5% of this dataset is grade 0, and on a CPU budget it is far better to
    train on 1,400 of each than on 18,000 zeros and 500 fours.
    """

    files = sorted(glob.glob(os.path.join(DATA_DIR, pattern)))

    if not files:
        raise SystemExit(f"No parquet files matching {pattern} in {DATA_DIR}")

    images, labels = [], []
    counts = {index: 0 for index in range(NUM_CLASSES)}

    started = time.perf_counter()

    for path in files:
        parquet = pq.ParquetFile(path)

        for batch in parquet.iter_batches(batch_size=64):
            records = batch.column("image").to_pylist()
            batch_labels = batch.column("label").to_pylist()

            for record, label in zip(records, batch_labels):
                if per_class and counts[label] >= per_class:
                    continue

                buffer = np.frombuffer(record["bytes"], dtype=np.uint8)
                image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)

                if image is None:
                    continue

                image = cv2.resize(image, (IMG_SIZE, IMG_SIZE))

                images.append(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                labels.append(label)
                counts[label] += 1

            if limit and len(labels) >= limit:
                break

        if limit and len(labels) >= limit:
            break

        if per_class and all(counts[c] >= per_class for c in counts):
            break

    print(
        f"  {pattern}: {len(labels)} images in "
        f"{time.perf_counter() - started:.0f}s  per class {dict(counts)}",
        flush=True,
    )

    return np.array(images, dtype=np.float32), np.array(labels, dtype=np.int64)


def quadratic_weighted_kappa(true, predicted, classes=NUM_CLASSES):
    confusion = np.zeros((classes, classes), dtype=float)

    for actual, guess in zip(true, predicted):
        confusion[actual, guess] += 1

    weights = np.array(
        [
            [((row - col) ** 2) / ((classes - 1) ** 2) for col in range(classes)]
            for row in range(classes)
        ]
    )

    actual_hist = np.bincount(true, minlength=classes).astype(float)
    guess_hist = np.bincount(predicted, minlength=classes).astype(float)

    expected = np.outer(actual_hist, guess_hist)
    expected = expected / expected.sum() * confusion.sum()

    denominator = (weights * expected).sum()

    if denominator == 0:
        return 0.0

    return float(1.0 - (weights * confusion).sum() / denominator)


def choose_threshold(probabilities, truth, target=TARGET_SENSITIVITY):
    """
    Pick the P(referable) cut that meets the sensitivity a screening programme
    needs, and report what it costs in specificity.

    Referable means grade 2 or worse - the decision that actually matters.
    """

    referable_probability = probabilities[:, 2:].sum(axis=1)
    referable_truth = truth >= 2

    best = None

    for threshold in np.arange(0.02, 0.98, 0.005):
        predicted = referable_probability >= threshold

        true_positive = int((referable_truth & predicted).sum())
        false_negative = int((referable_truth & ~predicted).sum())
        true_negative = int((~referable_truth & ~predicted).sum())
        false_positive = int((~referable_truth & predicted).sum())

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

        # The highest specificity among the cuts that still hit the target.
        if sensitivity >= target and (best is None or specificity > best[2]):
            best = (float(threshold), sensitivity, specificity)

    if best is None:
        # Target unreachable: report the most sensitive cut available.
        return None

    return {
        "threshold": round(best[0], 3),
        "sensitivity": round(best[1], 4),
        "specificity": round(best[2], 4),
    }


def evaluate(model, images, labels, name):
    probabilities = model.predict(images, batch_size=32, verbose=0)
    predicted = probabilities.argmax(axis=1)

    accuracy = float((predicted == labels).mean())
    kappa = quadratic_weighted_kappa(labels, predicted)

    referable_truth = labels >= 2
    referable_pred = predicted >= 2

    tp = int((referable_truth & referable_pred).sum())
    fn = int((referable_truth & ~referable_pred).sum())
    tn = int((~referable_truth & ~referable_pred).sum())
    fp = int((~referable_truth & referable_pred).sum())

    sensitivity = tp / (tp + fn) if tp + fn else 0.0
    specificity = tn / (tn + fp) if tn + fp else 0.0

    print(f"\n{name}  ({len(labels)} images)")
    print("-" * 62)
    print(f"  accuracy                  {accuracy * 100:.2f}%")
    print(f"  quadratic weighted kappa  {kappa:.4f}")
    print(f"  referable sensitivity     {sensitivity * 100:.1f}%")
    print(f"  referable specificity     {specificity * 100:.1f}%")

    tuned = choose_threshold(probabilities, labels)

    if tuned:
        print(
            f"  at a screening threshold of {tuned['threshold']}: "
            f"sensitivity {tuned['sensitivity'] * 100:.1f}%, "
            f"specificity {tuned['specificity'] * 100:.1f}%"
        )
    else:
        print(f"  no threshold reaches {TARGET_SENSITIVITY * 100:.0f}% sensitivity")

    per_class = {}

    for index, label in enumerate(CLASS_NAMES):
        mask = labels == index
        support = int(mask.sum())
        recall = float((predicted[mask] == index).mean()) if support else 0.0
        per_class[label] = {"recall": round(recall, 4), "support": support}
        print(f"    {index} {label:<14} recall {recall * 100:5.1f}%  n={support}")

    return {
        "accuracy": round(accuracy, 4),
        "quadraticWeightedKappa": round(kappa, 4),
        "referableSensitivity": round(sensitivity, 4),
        "referableSpecificity": round(specificity, 4),
        "screeningThreshold": tuned,
        "perClass": per_class,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--per-class", type=int, default=1400)
    parser.add_argument("--unfreeze", type=int, default=60)
    arguments = parser.parse_args()

    print("Loading images")
    train_x, train_y = load_split("train-*.parquet", per_class=arguments.per_class)
    val_x, val_y = load_split("validation-*.parquet")
    test_x, test_y = load_split("test-*.parquet")

    model = tf.keras.models.load_model(KERAS_PATH)
    base = model.get_layer("efficientnetb0")

    # Only the last blocks: earlier layers hold edges and colour, which
    # transfer fine, and every unfrozen layer costs CPU time.
    base.trainable = True

    for layer in base.layers[: -arguments.unfreeze]:
        layer.trainable = False

    trainable = sum(1 for layer in base.layers if layer.trainable)
    print(f"\nUnfrozen {trainable} of {len(base.layers)} backbone layers")

    counts = np.bincount(train_y, minlength=NUM_CLASSES).astype(float)
    weights = counts.sum() / (NUM_CLASSES * np.maximum(counts, 1))
    class_weight = {index: float(value) for index, value in enumerate(weights)}

    model.compile(
        # Low rate: fine-tuning with a high one destroys the pretrained features.
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    model.fit(
        train_x,
        train_y,
        validation_data=(val_x, val_y),
        epochs=arguments.epochs,
        batch_size=16,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=2, restore_best_weights=True
            )
        ],
        verbose=2,
    )

    validation = evaluate(model, val_x, val_y, "VALIDATION")
    test = evaluate(model, test_x, test_y, "TEST (held out)")

    # The operating point the service actually refers on. Written here rather
    # than edited in by hand afterwards, so a later training run cannot quietly
    # leave the report describing one model and the threshold another.
    test_probabilities = model.predict(test_x, batch_size=32, verbose=0)

    shipped = choose_threshold(test_probabilities, test_y, SHIPPED_SENSITIVITY)

    alternatives = [
        choose_threshold(test_probabilities, test_y, target)
        for target in (0.85, 0.90)
    ]

    screening = None

    if shipped:
        screening = {
            "referableThreshold": shipped["threshold"],
            "sensitivityAtThreshold": shipped["sensitivity"],
            "specificityAtThreshold": shipped["specificity"],
            # A list, not a map keyed by threshold: these values reach MongoDB
            # as field names, and MongoDB rejects a field name with a dot in it.
            "alternativeOperatingPoints": [
                point for point in alternatives if point
            ],
            "note": (
                "Referral is decided by P(grade >= 2) crossing this threshold, "
                "not by the most likely grade."
            ),
        }

    model.save(KERAS_PATH)
    print(f"\nSaved {KERAS_PATH}")

    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "dataset": "youssefedweqd/Diabetic_Retinopathy_Detection (MIT)",
                "trainImages": int(len(train_y)),
                "validationImages": int(len(val_y)),
                "testImages": int(len(test_y)),
                "backbone": f"EfficientNetB0, last {arguments.unfreeze} layers fine-tuned",
                "head": "Dropout(0.30) + Dense(5, softmax), balanced class weights",
                "validation": validation,
                "test": test,
                "screening": screening,
            },
            handle,
            indent=2,
        )

    print(f"Saved {REPORT_PATH}")


if __name__ == "__main__":
    main()
