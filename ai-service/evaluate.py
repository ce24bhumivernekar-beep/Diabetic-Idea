import tensorflow as tf
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

# ============================================================
# SETTINGS
# ============================================================

IMG_SIZE = 224
BATCH_SIZE = 16

TEST_DIR = "data/processed/test"
MODEL_PATH = "models/dr_model.keras"

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative"
]

# ============================================================
# LOAD MODEL
# ============================================================

print("Loading trained model...")

model = tf.keras.models.load_model(MODEL_PATH)

print("Model loaded successfully.")

# ============================================================
# LOAD TEST DATA
# ============================================================

print("\nLoading test dataset...")

test_ds = tf.keras.utils.image_dataset_from_directory(
    TEST_DIR,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="int",
    shuffle=False
)

# ============================================================
# GET TRUE LABELS + PREDICTIONS
# ============================================================

true_labels = []
predicted_labels = []

print("\nRunning predictions...")

for images, labels in test_ds:

    predictions = model.predict(
        images,
        verbose=0
    )

    predicted_classes = np.argmax(
        predictions,
        axis=1
    )

    true_labels.extend(
        labels.numpy()
    )

    predicted_labels.extend(
        predicted_classes
    )

true_labels = np.array(true_labels)
predicted_labels = np.array(predicted_labels)

# ============================================================
# CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(
    true_labels,
    predicted_labels
)

print("\n==============================")
print("CONFUSION MATRIX")
print("==============================")

print(cm)

# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\n==============================")
print("CLASSIFICATION REPORT")
print("==============================")

print(
    classification_report(
        true_labels,
        predicted_labels,
        target_names=CLASS_NAMES,
        zero_division=0
    )
)

# ============================================================
# ACCURACY
# ============================================================

accuracy = np.mean(
    true_labels == predicted_labels
)

print("==============================")
print(f"TEST ACCURACY: {accuracy * 100:.2f}%")
print("==============================")