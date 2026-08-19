"""
Does the model work on images it has never seen from a camera it has never seen?

Every number this project quotes so far comes from one dataset - one set of
cameras, one population, one grading team. A model can score well there by
learning that dataset's particular look, and a judge, a clinician or a regulator
will ask the same question: does it hold up somewhere else.

This runs the shipped ONNX model against an external dataset and reports the
same numbers, so the two are directly comparable. Nothing is retrained and no
threshold is re-tuned first - the point is to see what the deployed system would
actually have done.

Two external sets are supported, both public and ungated:

  messidor2  1,744 images, Topcon TRC NW6, French population (Abramoff grades)
  idrid        516 images, Kowa VX-10a, Indian population

The second matters more for this project than the first.

    venv\\Scripts\\python validate_external.py --dataset messidor2
"""

import argparse
import glob
import json
import os
import time

import cv2
import numpy as np
import onnxruntime as ort
import pyarrow.parquet as pq

IMG_SIZE = 224
NUM_CLASSES = 5
CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

MODEL_DIR = "models"
ONNX_PATH = os.path.join(MODEL_DIR, "dr_model.onnx")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.json")

DATASETS = {
    "messidor2": {
        "path": os.path.join("data", "external", "messidor2"),
        "description": "Messidor-2, Topcon TRC NW6, French population",
    },
    "idrid": {
        "path": os.path.join("data", "external", "idrid"),
        "description": "IDRiD, Kowa VX-10a, Indian population",
    },
}


def shipped_threshold():
    """The cut the deployed service actually refers on."""

    with open(REPORT_PATH, "r", encoding="utf-8") as handle:
        screening = json.load(handle).get("screening") or {}

    return screening.get("referableThreshold")


def load_parquets(root):
    files = sorted(glob.glob(os.path.join(root, "**", "*.parquet"), recursive=True))

    if not files:
        raise SystemExit(
            f"No parquet files under {root}. Download the dataset first."
        )

    images, labels = [], []
    started = time.perf_counter()

    for path in files:
        parquet = pq.ParquetFile(path)

        # schema_arrow, not schema: the parquet schema flattens a struct into
        # its leaves, so an "image" struct shows up as "bytes" and "path" and
        # then cannot be read by either name.
        columns = set(parquet.schema_arrow.names)

        # HuggingFace writes an image column either as a struct named "image"
        # with a "bytes" field, or - when the dataset was built from a folder -
        # as a flat "bytes" column. Both appear among these datasets.
        image_column = (
            "image" if "image" in columns
            else "bytes" if "bytes" in columns
            else None
        )

        label_column = "label" if "label" in columns else None

        if not image_column or not label_column:
            raise SystemExit(
                f"{os.path.basename(path)} has columns {sorted(columns)}, "
                "expected an image column and 'label'"
            )

        for batch in parquet.iter_batches(batch_size=32):
            records = batch.column(image_column).to_pylist()
            batch_labels = batch.column(label_column).to_pylist()

            for record, label in zip(records, batch_labels):
                raw = record["bytes"] if isinstance(record, dict) else record

                image = cv2.imdecode(
                    np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR
                )

                if image is None:
                    continue

                image = cv2.resize(
                    image, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA
                )

                images.append(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                labels.append(int(label))

    print(
        f"  loaded {len(labels)} images from {len(files)} shard(s) "
        f"in {time.perf_counter() - started:.0f}s"
    )

    return (
        np.asarray(images, dtype=np.float32),
        np.asarray(labels, dtype=np.int64),
    )


def predict(images, batch=32):
    session = ort.InferenceSession(
        ONNX_PATH, providers=["CPUExecutionProvider"]
    )

    name = session.get_inputs()[0].name
    output = []

    for start in range(0, len(images), batch):
        chunk = images[start : start + batch]
        results = session.run(None, {name: chunk})
        output.append(next(o for o in results if o.ndim == 2))

    return np.concatenate(output, axis=0)


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

    expected = np.outer(
        np.bincount(true, minlength=classes),
        np.bincount(predicted, minlength=classes),
    ).astype(float)

    expected = expected / expected.sum() * confusion.sum()

    denominator = (weights * expected).sum()

    return (
        0.0
        if denominator == 0
        else float(1.0 - (weights * confusion).sum() / denominator)
    )


def sensitivity_specificity(referable_probability, truth, threshold):
    predicted = referable_probability >= threshold
    referable = truth >= 2

    tp = int((referable & predicted).sum())
    fn = int((referable & ~predicted).sum())
    tn = int(((~referable) & (~predicted)).sum())
    fp = int(((~referable) & predicted).sum())

    return (
        tp / (tp + fn) if tp + fn else 0.0,
        tn / (tn + fp) if tn + fp else 0.0,
        {"tp": tp, "fn": fn, "tn": tn, "fp": fp},
    )


def best_threshold(referable_probability, truth, target):
    best = None

    for threshold in np.arange(0.005, 0.995, 0.005):
        sensitivity, specificity, _ = sensitivity_specificity(
            referable_probability, truth, threshold
        )

        if sensitivity >= target and (best is None or specificity > best[2]):
            best = (float(threshold), sensitivity, specificity)

    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", choices=sorted(DATASETS), default="messidor2")
    arguments = parser.parse_args()

    dataset = DATASETS[arguments.dataset]

    print(f"\nEXTERNAL VALIDATION - {dataset['description']}")
    print("=" * 66)

    images, labels = load_parquets(dataset["path"])

    counts = np.bincount(labels, minlength=NUM_CLASSES)
    print("  grades  " + "  ".join(f"{i}:{counts[i]}" for i in range(NUM_CLASSES)))

    if (labels >= 2).sum() == 0:
        print(
            "\n  This subset contains no referable images, so sensitivity is "
            "undefined.\n  Download the remaining shards before drawing any "
            "conclusion."
        )

    started = time.perf_counter()
    probabilities = predict(images)
    elapsed = time.perf_counter() - started

    print(
        f"  inference {elapsed:.0f}s for {len(labels)} images "
        f"({elapsed / max(len(labels), 1) * 1000:.0f} ms each)"
    )

    predicted = probabilities.argmax(axis=1)
    referable_probability = probabilities[:, 2:].sum(axis=1)

    threshold = shipped_threshold()

    print(f"\n  quadratic weighted kappa   {quadratic_weighted_kappa(labels, predicted):.4f}")

    if (labels >= 2).sum() and (labels < 2).sum():
        sensitivity, specificity, matrix = sensitivity_specificity(
            referable_probability, labels, threshold
        )

        print(
            f"\n  AT THE SHIPPED THRESHOLD ({threshold}) - what the deployed "
            "service would have done"
        )
        print(f"    sensitivity  {sensitivity * 100:5.1f}%   specificity  {specificity * 100:5.1f}%")
        print(
            f"    caught {matrix['tp']} of {matrix['tp'] + matrix['fn']} referable, "
            f"missed {matrix['fn']}; cleared {matrix['tn']} of "
            f"{matrix['tn'] + matrix['fp']} healthy"
        )

        print("\n  IF THE THRESHOLD WERE RE-TUNED ON THIS DATASET")

        for target in (0.80, 0.85, 0.90):
            point = best_threshold(referable_probability, labels, target)

            if point:
                print(
                    f"    {int(target * 100)}% sensitivity -> specificity "
                    f"{point[2] * 100:5.1f}%  (cut {point[0]:.3f})"
                )
            else:
                print(f"    {int(target * 100)}% sensitivity unreachable")

    print("\n  PER CLASS")

    for index, name in enumerate(CLASS_NAMES):
        mask = labels == index
        support = int(mask.sum())

        if support:
            recall = float((predicted[mask] == index).mean())
            print(f"    {index} {name:<14} recall {recall * 100:5.1f}%  n={support}")

    print()


if __name__ == "__main__":
    main()
