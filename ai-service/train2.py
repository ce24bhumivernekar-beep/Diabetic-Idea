"""
Second training pass, aimed squarely at Moderate (grade 2).

The shipped model reaches kappa 0.425 and 80.9% referable sensitivity, but its
per-class recall is lopsided: No DR 48%, Mild 51%, Moderate 21%, Severe 34%,
Proliferative 71%. Moderate is the referral boundary - it is the first grade
that should send someone to a specialist - so a model that recognises one in
five of them is weakest exactly where the decision is made.

Four changes, each with a reason:

1. SELECT THE CHECKPOINT ON THE METRIC WE ACTUALLY USE.
   The previous run early-stopped on validation loss and kept epoch 2. But the
   number this product lives on is specificity at 80% sensitivity, and there is
   no reason for that to peak when cross-entropy does - cross-entropy rewards
   confident correct answers on the 73% of images that are grade 0. Every epoch
   now computes the real operating point on validation, and the best one is
   kept. This is the change most likely to matter, and it costs nothing.

2. AUGMENTATION.
   Grades 3 and 4 have 628 and 509 training images. There is no more data to
   find, so the images have to work harder: flips, rotation, zoom and
   brightness/contrast jitter. A retina is orientation-agnostic once laterality
   is recorded separately, so flips are safe here in a way they would not be for,
   say, text.

3. KEEP EVERY RARE IMAGE.
   Capping all classes at one number threw away 1,300 grade 2 images while doing
   nothing for grade 4. cache_dataset.py now keeps all of grades 1-4 and caps
   only grade 0.

4. SOFTER CLASS WEIGHTS.
   Full inverse-frequency weighting makes one grade 4 image worth eight grade 0
   images, and with 509 of them the gradient becomes noise. Square-rooting the
   weights keeps the correction and loses the thrash.

Deliberately NOT changed: the 5-class softmax head. An ordinal head would
supervise P(grade >= 2) directly, which is exactly what we threshold on, and it
is the better design - but it changes the output shape the serving code, the
CAM weights and the report all depend on. That is a rewrite, not a training run.

    venv\\Scripts\\python train2.py --epochs 20 --unfreeze 120
"""

import argparse
import json
import os
import time

import numpy as np
import tensorflow as tf

IMG_SIZE = 224
NUM_CLASSES = 5
CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

CACHE_DIR = os.path.join("data", "cache")
MODEL_DIR = "models"
KERAS_PATH = os.path.join(MODEL_DIR, "dr_model.keras")
OUT_PATH = os.path.join(MODEL_DIR, "dr_model_v3.keras")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.json")

# The sensitivity a screening programme is held to; specificity at this point
# is the number that decides whether a new model is actually better.
TARGET_SENSITIVITY = 0.80


# ============================================================
# DATA
# ============================================================


def load_cached(split):
    x = np.load(os.path.join(CACHE_DIR, f"{split}_x.npy"), mmap_mode="r")
    y = np.load(os.path.join(CACHE_DIR, f"{split}_y.npy"))
    return x, y


def augment(image):
    """
    Cheap geometric and photometric jitter.

    Rotation is small on purpose: a fundus photograph arrives roughly level,
    and teaching the model to recognise a retina at 40 degrees spends capacity
    on a case that will never reach it.
    """

    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_flip_up_down(image)

    image = tf.image.random_brightness(image, max_delta=20.0)
    image = tf.image.random_contrast(image, lower=0.85, upper=1.15)

    # +/- 12 degrees, via one of the four rotations plus a small affine shift
    # would need tfa; a small random zoom-and-crop achieves the same effect
    # with core ops only.
    scale = tf.random.uniform([], 0.90, 1.0)
    size = tf.cast(tf.cast(IMG_SIZE, tf.float32) * scale, tf.int32)

    image = tf.image.random_crop(image, size=[size, size, 3])
    image = tf.image.resize(image, [IMG_SIZE, IMG_SIZE])

    return tf.clip_by_value(image, 0.0, 255.0)


def make_dataset(x, y, batch_size, training):
    indices = np.arange(len(y))

    dataset = tf.data.Dataset.from_tensor_slices(indices)

    if training:
        dataset = dataset.shuffle(len(indices), reshuffle_each_iteration=True)

    def fetch(index):
        image = tf.numpy_function(
            lambda i: np.asarray(x[i], dtype=np.float32), [index], tf.float32
        )
        image.set_shape([IMG_SIZE, IMG_SIZE, 3])

        label = tf.numpy_function(
            lambda i: np.int64(y[i]), [index], tf.int64
        )
        label.set_shape([])

        if training:
            image = augment(image)

        return image, label

    return (
        dataset.map(fetch, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )


# ============================================================
# METRICS
# ============================================================


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

    if denominator == 0:
        return 0.0

    return float(1.0 - (weights * confusion).sum() / denominator)


def operating_point(probabilities, truth, target=TARGET_SENSITIVITY):
    """The highest specificity among cuts that still meet the sensitivity target."""

    referable_probability = probabilities[:, 2:].sum(axis=1)
    referable_truth = truth >= 2

    best = None

    for threshold in np.arange(0.005, 0.995, 0.005):
        predicted = referable_probability >= threshold

        true_positive = int((referable_truth & predicted).sum())
        false_negative = int((referable_truth & ~predicted).sum())
        true_negative = int(((~referable_truth) & (~predicted)).sum())
        false_positive = int(((~referable_truth) & predicted).sum())

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

        if sensitivity >= target and (best is None or specificity > best[2]):
            best = (float(threshold), sensitivity, specificity)

    if best is None:
        return None

    return {
        "threshold": round(best[0], 3),
        "sensitivity": round(best[1], 4),
        "specificity": round(best[2], 4),
    }


class TrackOperatingPoint(tf.keras.callbacks.Callback):
    """
    Score every epoch on the metric the product uses, and keep the best weights.

    Keras can only early-stop on something it computes during training, and it
    computes loss and accuracy. Neither is what a screening programme is judged
    on, so the check runs here instead.
    """

    def __init__(self, x, y, patience=5):
        super().__init__()
        self.x = x
        self.y = y
        self.patience = patience
        self.best_specificity = -1.0
        self.best_weights = None
        self.best_epoch = -1
        self.waited = 0
        self.history = []

    def on_epoch_end(self, epoch, logs=None):
        probabilities = self.model.predict(self.x, batch_size=32, verbose=0)

        point = operating_point(probabilities, self.y)

        predicted = probabilities.argmax(axis=1)
        kappa = quadratic_weighted_kappa(self.y, predicted)

        moderate = self.y == 2
        moderate_recall = (
            float((predicted[moderate] == 2).mean()) if moderate.any() else 0.0
        )

        specificity = point["specificity"] if point else 0.0

        self.history.append(
            {
                "epoch": epoch + 1,
                "kappa": round(kappa, 4),
                "specificityAt80": round(specificity, 4),
                "moderateRecall": round(moderate_recall, 4),
            }
        )

        marker = ""

        if specificity > self.best_specificity:
            self.best_specificity = specificity
            self.best_weights = self.model.get_weights()
            self.best_epoch = epoch + 1
            self.waited = 0
            marker = "  <- best"
        else:
            self.waited += 1

        print(
            f"    epoch {epoch + 1:2}  kappa {kappa:.4f}  "
            f"spec@80%sens {specificity * 100:5.1f}%  "
            f"moderate recall {moderate_recall * 100:5.1f}%{marker}",
            flush=True,
        )

        if self.waited >= self.patience:
            print(
                f"    no gain in {self.patience} epochs - stopping",
                flush=True,
            )
            self.model.stop_training = True

    def restore(self):
        if self.best_weights is not None:
            self.model.set_weights(self.best_weights)
            print(f"\nRestored epoch {self.best_epoch}", flush=True)


# ============================================================
# EVALUATION
# ============================================================


def evaluate(model, x, y, name):
    probabilities = model.predict(x, batch_size=32, verbose=0)
    predicted = probabilities.argmax(axis=1)

    kappa = quadratic_weighted_kappa(y, predicted)

    print(f"\n{name}  ({len(y)} images)")
    print("-" * 62)
    print(f"  accuracy                  {(predicted == y).mean() * 100:.2f}%")
    print(f"  quadratic weighted kappa  {kappa:.4f}")

    points = {}

    for target in (0.80, 0.85, 0.90):
        point = operating_point(probabilities, y, target)
        points[f"{int(target * 100)}"] = point

        if point:
            print(
                f"  at {int(target * 100)}% sensitivity -> specificity "
                f"{point['specificity'] * 100:5.1f}%  (cut {point['threshold']})"
            )

    per_class = {}

    for index, label in enumerate(CLASS_NAMES):
        mask = y == index
        support = int(mask.sum())
        recall = float((predicted[mask] == index).mean()) if support else 0.0
        per_class[label] = {"recall": round(recall, 4), "support": support}
        print(f"    {index} {label:<14} recall {recall * 100:5.1f}%  n={support}")

    return {
        "accuracy": round(float((predicted == y).mean()), 4),
        "quadraticWeightedKappa": round(kappa, 4),
        "operatingPoints": points,
        "perClass": per_class,
    }


# ============================================================
# MAIN
# ============================================================


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--unfreeze", type=int, default=120)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=5)
    arguments = parser.parse_args()

    train_x, train_y = load_cached("train")
    val_x, val_y = load_cached("validation")
    test_x, test_y = load_cached("test")

    print(
        f"train {len(train_y)}  validation {len(val_y)}  test {len(test_y)}",
        flush=True,
    )

    model = tf.keras.models.load_model(KERAS_PATH)
    base = model.get_layer("efficientnetb0")

    base.trainable = True

    for layer in base.layers[: -arguments.unfreeze]:
        layer.trainable = False

    print(
        f"unfrozen {sum(1 for l in base.layers if l.trainable)} "
        f"of {len(base.layers)} backbone layers",
        flush=True,
    )

    counts = np.bincount(train_y, minlength=NUM_CLASSES).astype(float)

    # Square-rooted inverse frequency: keeps the correction, drops the thrash.
    weights = np.sqrt(counts.sum() / (NUM_CLASSES * np.maximum(counts, 1)))
    class_weight = {index: float(value) for index, value in enumerate(weights)}

    print("class weights " + "  ".join(f"{k}:{v:.2f}" for k, v in class_weight.items()))

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=arguments.lr),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )

    tracker = TrackOperatingPoint(
        np.asarray(val_x, dtype=np.float32), val_y, patience=arguments.patience
    )

    started = time.perf_counter()

    model.fit(
        make_dataset(train_x, train_y, arguments.batch, training=True),
        epochs=arguments.epochs,
        class_weight=class_weight,
        callbacks=[
            tracker,
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="loss", factor=0.5, patience=2, min_lr=1e-6, verbose=1
            ),
        ],
        verbose=2,
    )

    tracker.restore()

    print(f"\ntrained in {(time.perf_counter() - started) / 60:.0f} minutes")

    test = evaluate(
        model, np.asarray(test_x, dtype=np.float32), test_y, "TEST (held out)"
    )

    model.save(OUT_PATH)
    print(f"\nSaved {OUT_PATH}")

    with open(os.path.join(MODEL_DIR, "train2_report.json"), "w", encoding="utf-8") as handle:
        json.dump(
            {
                "run": "train2",
                "backbone": f"EfficientNetB0, last {arguments.unfreeze} layers fine-tuned",
                "trainImages": int(len(train_y)),
                "selection": "best specificity at 80% sensitivity on validation",
                "bestEpoch": tracker.best_epoch,
                "epochHistory": tracker.history,
                "test": test,
            },
            handle,
            indent=2,
        )

    print("Saved models/train2_report.json")
    print("\nNOT shipped. Compare against the current model before replacing it.")


if __name__ == "__main__":
    main()
