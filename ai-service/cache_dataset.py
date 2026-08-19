"""
Decode the parquet shards once and keep the pixels.

Every training run so far paid the same tax: decoding 12,500 JPEGs with OpenCV
before a single gradient step, several minutes each time, for bytes that never
change. This writes them out once as uint8 arrays so a run starts in seconds.

uint8, not float32, and deliberately: the same images as float32 are four times
the size and would not fit alongside a training process. Conversion happens per
batch, where it costs nothing.

What gets cached is also a decision, not just a copy. The training split is
badly skewed - 18,583 images of grade 0 against 509 of grade 4 - and the
previous run capped every class at the same number, which threw away 1,300 of
the grade 2 images it most needed while still being unable to find more grade 4.
So: keep every image of grades 1-4, and cap grade 0 at a multiple of the largest
minority class. Fewer images than before, more of the rare ones.

    venv\\Scripts\\python cache_dataset.py
"""

import glob
import os
import time

import cv2
import numpy as np
import pyarrow.parquet as pq

IMG_SIZE = 224
NUM_CLASSES = 5

DATA_DIR = os.path.join("data", "hf")
CACHE_DIR = os.path.join("data", "cache")

# Grade 0 is 73% of the training split. Capping it here rather than weighting it
# away later keeps the epoch short; the class weights still correct what is left.
MAJORITY_CAP = 4000


def decode_split(pattern, caps):
    files = sorted(glob.glob(os.path.join(DATA_DIR, pattern)))

    if not files:
        raise SystemExit(f"No parquet files matching {pattern} in {DATA_DIR}")

    images, labels = [], []
    kept = {index: 0 for index in range(NUM_CLASSES)}
    started = time.perf_counter()

    for path in files:
        for batch in pq.ParquetFile(path).iter_batches(batch_size=64):
            records = batch.column("image").to_pylist()
            batch_labels = batch.column("label").to_pylist()

            for record, label in zip(records, batch_labels):
                if caps and kept[label] >= caps.get(label, 10 ** 9):
                    continue

                image = cv2.imdecode(
                    np.frombuffer(record["bytes"], dtype=np.uint8),
                    cv2.IMREAD_COLOR,
                )

                if image is None:
                    continue

                image = cv2.resize(
                    image, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA
                )

                images.append(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                labels.append(label)
                kept[label] += 1

    elapsed = time.perf_counter() - started

    print(
        f"  {pattern:22} {len(labels):6} images in {elapsed:5.0f}s   "
        + "  ".join(f"{k}:{kept[k]}" for k in sorted(kept))
    )

    return (
        np.asarray(images, dtype=np.uint8),
        np.asarray(labels, dtype=np.int64),
    )


def main():
    os.makedirs(CACHE_DIR, exist_ok=True)

    print("Decoding once, so no run has to do it again")

    splits = {
        # Only the training split is capped. Validation and test must stay
        # exactly as they are, or the measured numbers stop meaning anything.
        "train": ("train-*.parquet", {0: MAJORITY_CAP}),
        "validation": ("validation-*.parquet", None),
        "test": ("test-*.parquet", None),
    }

    for name, (pattern, caps) in splits.items():
        images, labels = decode_split(pattern, caps)

        np.save(os.path.join(CACHE_DIR, f"{name}_x.npy"), images)
        np.save(os.path.join(CACHE_DIR, f"{name}_y.npy"), labels)

        size = images.nbytes / 1e9
        print(f"    -> {name}_x.npy  {size:.2f} GB")

    print("\nCached. Training runs now start immediately.")


if __name__ == "__main__":
    main()
