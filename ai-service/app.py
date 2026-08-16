import os
import uuid
import numpy as np
import tensorflow as tf
import cv2

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

# ============================================================
# SETTINGS
# ============================================================

MODEL_PATH = "models/dr_model.keras"
IMG_SIZE = 224

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative"
]

OUTPUT_DIR = "generated"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# LOAD MODEL
# ============================================================

print("Loading model...")

model = tf.keras.models.load_model(MODEL_PATH)

print("Model loaded successfully.")

# ============================================================
# GET EFFICIENTNET + CLASSIFICATION LAYERS
# ============================================================

base_model = model.get_layer("efficientnetb0")

last_conv_layer = base_model.get_layer("top_conv")

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
# FASTAPI
# ============================================================

app = FastAPI(
    title="Diabetic Retinopathy AI Service",
    version="1.0"
)

# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Diabetic Retinopathy AI Service is running"
    }

# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

# ============================================================
# PREDICTION + GRAD-CAM
# ============================================================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # Validate file
    # --------------------------------------------------------

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File type is missing."
        )

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/jpg"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG images are allowed."
        )

    # --------------------------------------------------------
    # Read image
    # --------------------------------------------------------

    contents = await file.read()

    image_array = np.frombuffer(
        contents,
        dtype=np.uint8
    )

    original_image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if original_image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image."
        )

    # --------------------------------------------------------
    # Prepare model input
    # --------------------------------------------------------

    original_rgb = cv2.cvtColor(
        original_image,
        cv2.COLOR_BGR2RGB
    )

    resized = cv2.resize(
        original_rgb,
        (IMG_SIZE, IMG_SIZE)
    )

    model_input = np.expand_dims(
        resized.astype(np.float32),
        axis=0
    )

    # --------------------------------------------------------
    # Grad-CAM
    # --------------------------------------------------------

    with tf.GradientTape() as tape:

        conv_outputs = base_model(
            model_input,
            training=False
        )

        # Get final convolution output
        conv_outputs_for_cam = last_conv_layer(
            conv_outputs
        ) if False else conv_outputs

        # Classification head
        x = global_pool(
            conv_outputs
        )

        x = dropout(
            x,
            training=False
        )

        predictions = classifier(x)

        predicted_class = tf.argmax(
            predictions[0]
        )

        class_score = predictions[
            0,
            predicted_class
        ]

    gradients = tape.gradient(
        class_score,
        conv_outputs
    )

    if gradients is None:
        raise HTTPException(
            status_code=500,
            detail="Could not calculate Grad-CAM."
        )

    # --------------------------------------------------------
    # Create heatmap
    # --------------------------------------------------------

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

    heatmap = tf.maximum(
        heatmap,
        0
    )

    max_value = tf.reduce_max(
        heatmap
    )

    if float(max_value) > 0:
        heatmap = heatmap / max_value

    heatmap = heatmap.numpy()

    # --------------------------------------------------------
    # Resize heatmap to original image
    # --------------------------------------------------------

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

    overlay = cv2.addWeighted(
        original_image,
        0.60,
        colored_heatmap,
        0.40,
        0
    )

    # --------------------------------------------------------
    # Create unique filenames
    # --------------------------------------------------------

    image_id = str(
        uuid.uuid4()
    )

    original_path = os.path.join(
        OUTPUT_DIR,
        f"{image_id}_original.png"
    )

    heatmap_path = os.path.join(
        OUTPUT_DIR,
        f"{image_id}_heatmap.png"
    )

    overlay_path = os.path.join(
        OUTPUT_DIR,
        f"{image_id}_overlay.png"
    )

    # --------------------------------------------------------
    # Save images
    # --------------------------------------------------------

    cv2.imwrite(
        original_path,
        original_image
    )

    cv2.imwrite(
        heatmap_path,
        colored_heatmap
    )

    cv2.imwrite(
        overlay_path,
        overlay
    )

    # --------------------------------------------------------
    # Prediction information
    # --------------------------------------------------------

    class_id = int(
        predicted_class.numpy()
    )

    confidence = float(
        predictions[0, class_id].numpy()
    )

    probabilities = {
        CLASS_NAMES[i]: float(
            predictions[0, i].numpy()
        )
        for i in range(len(CLASS_NAMES))
    }

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {
        "prediction": CLASS_NAMES[class_id],
        "classId": class_id,
        "confidence": confidence,
        "probabilities": probabilities,
        "originalImage": original_path,
        "heatmap": heatmap_path,
        "overlay": overlay_path
    }

# ============================================================
# SERVE GENERATED IMAGE
# ============================================================

@app.get("/generated/{filename}")
def get_generated_image(
    filename: str
):

    file_path = os.path.join(
        OUTPUT_DIR,
        filename
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Image not found."
        )

    return FileResponse(file_path)