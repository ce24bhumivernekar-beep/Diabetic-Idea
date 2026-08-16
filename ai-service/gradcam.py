import os
import numpy as np
import tensorflow as tf
import cv2

# ============================================================
# SETTINGS
# ============================================================

MODEL_PATH = "models/dr_model.keras"

IMAGE_DIR = "data/processed/test/2"

OUTPUT_DIR = "generated"

IMG_SIZE = 224

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative"
]

# ============================================================
# FIND TEST IMAGE
# ============================================================

image_files = [
    file
    for file in os.listdir(IMAGE_DIR)
    if file.lower().endswith(".png")
]

if not image_files:
    raise FileNotFoundError(
        f"No PNG images found in {IMAGE_DIR}"
    )

image_path = os.path.join(
    IMAGE_DIR,
    image_files[0]
)

print("Using image:")
print(image_path)

# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading model...")

model = tf.keras.models.load_model(
    MODEL_PATH
)

print("Model loaded successfully.")

# ============================================================
# GET NESTED EFFICIENTNET
# ============================================================

base_model = model.get_layer(
    "efficientnetb0"
)

# Final convolutional layer
last_conv_layer = base_model.get_layer(
    "top_conv"
)

# ============================================================
# GET CLASSIFICATION HEAD
# ============================================================

global_pool = model.get_layer(
    "global_average_pooling2d"
)

dropout = model.get_layer(
    "dropout"
)

classifier = model.get_layer(
    "dense"
)

# ============================================================
# CREATE INTERMEDIATE FEATURE MODEL
# ============================================================

feature_model = tf.keras.Model(
    inputs=base_model.input,
    outputs=last_conv_layer.output
)

# ============================================================
# LOAD IMAGE
# ============================================================

original_image = cv2.imread(
    image_path
)

if original_image is None:
    raise ValueError(
        "Could not read the image."
    )

original_rgb = cv2.cvtColor(
    original_image,
    cv2.COLOR_BGR2RGB
)

resized_image = cv2.resize(
    original_rgb,
    (IMG_SIZE, IMG_SIZE)
)

image_array = np.array(
    resized_image,
    dtype=np.float32
)

image_array = np.expand_dims(
    image_array,
    axis=0
)

# ============================================================
# RUN MODEL + GRADIENT CALCULATION
# ============================================================

with tf.GradientTape() as tape:

    # Watch the convolution output
    conv_outputs = feature_model(
        image_array,
        training=False
    )

    tape.watch(conv_outputs)

    # Classification head
    x = global_pool(
        conv_outputs
    )

    x = dropout(
        x,
        training=False
    )

    predictions = classifier(
        x
    )

    # Find predicted class
    predicted_class = tf.argmax(
        predictions[0]
    )

    class_score = predictions[
        0,
        predicted_class
    ]

# ============================================================
# CALCULATE GRADIENTS
# ============================================================

gradients = tape.gradient(
    class_score,
    conv_outputs
)

if gradients is None:
    raise RuntimeError(
        "Gradients could not be calculated."
    )

# ============================================================
# GLOBAL AVERAGE POOLING
# ============================================================

pooled_gradients = tf.reduce_mean(
    gradients,
    axis=(0, 1, 2)
)

conv_outputs = conv_outputs[0]

heatmap = conv_outputs @ (
    pooled_gradients[..., tf.newaxis]
)

heatmap = tf.squeeze(
    heatmap
)

# Remove negative values
heatmap = tf.maximum(
    heatmap,
    0
)

# Normalize
max_value = tf.reduce_max(
    heatmap
)

if max_value > 0:
    heatmap = heatmap / max_value

heatmap = heatmap.numpy()

# ============================================================
# CREATE HEATMAP
# ============================================================

heatmap_uint8 = np.uint8(
    heatmap * 255
)

heatmap_uint8 = cv2.resize(
    heatmap_uint8,
    (
        original_image.shape[1],
        original_image.shape[0]
    )
)

colored_heatmap = cv2.applyColorMap(
    heatmap_uint8,
    cv2.COLORMAP_JET
)

# ============================================================
# CREATE OVERLAY
# ============================================================

overlay = cv2.addWeighted(
    original_image,
    0.60,
    colored_heatmap,
    0.40,
    0
)

# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True
)

# ============================================================
# SAVE OUTPUTS
# ============================================================

original_output = os.path.join(
    OUTPUT_DIR,
    "original.png"
)

heatmap_output = os.path.join(
    OUTPUT_DIR,
    "heatmap.png"
)

overlay_output = os.path.join(
    OUTPUT_DIR,
    "overlay.png"
)

cv2.imwrite(
    original_output,
    original_image
)

cv2.imwrite(
    heatmap_output,
    colored_heatmap
)

cv2.imwrite(
    overlay_output,
    overlay
)

# ============================================================
# RESULTS
# ============================================================

class_id = int(
    predicted_class.numpy()
)

confidence = float(
    predictions[0, class_id].numpy()
)

print("\n===================================")
print("GRAD-CAM COMPLETE")
print("===================================")

print(
    f"Prediction: {CLASS_NAMES[class_id]}"
)

print(
    f"Confidence: {confidence * 100:.2f}%"
)

print(
    f"Original image: {original_output}"
)

print(
    f"Heatmap: {heatmap_output}"
)

print(
    f"Overlay: {overlay_output}"
)