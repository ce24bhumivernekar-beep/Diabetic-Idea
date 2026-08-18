"""
Diabetic Retinopathy AI service.

Loads the trained EfficientNetB0 model, predicts the DR grade for a retinal
fundus image and returns a Grad-CAM heatmap that shows which regions drove
the decision.

Run:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

import json
import os
import uuid

import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# ============================================================
# SETTINGS
# ============================================================

MODEL_PATH = os.getenv("MODEL_PATH", "models/dr_model.keras")
MODEL_INFO_PATH = os.path.join(
    os.path.dirname(MODEL_PATH) or ".",
    "model_info.json",
)

IMG_SIZE = 224

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative"
]

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "generated")

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png"
}

ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080",
).split(",")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# LOAD MODEL
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise SystemExit(
        f"Model not found at {MODEL_PATH}.\n"
        "Either train one:   python prepare_dataset.py && python train.py\n"
        "or create a runnable placeholder:  python bootstrap_model.py"
    )

print(f"Loading model from {MODEL_PATH} ...")

model = tf.keras.models.load_model(MODEL_PATH)

print("Model loaded successfully.")


def read_model_info():
    """Tells callers whether these weights are actually trained."""

    if not os.path.exists(MODEL_INFO_PATH):
        return {"trained": True}

    try:

        with open(MODEL_INFO_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)

    except (OSError, ValueError):
        return {"trained": True}


MODEL_INFO = read_model_info()

MODEL_IS_TRAINED = bool(MODEL_INFO.get("trained", True))

if not MODEL_IS_TRAINED:
    print()
    print("*" * 62)
    print("WARNING: this model has an UNTRAINED classification head.")
    print("Predictions are placeholders so the pipeline can be demoed.")
    print("Run train.py on the real dataset before any clinical use.")
    print("*" * 62)
    print()

# ============================================================
# GRAD-CAM PIECES
#
# The saved model is: input -> augmentation -> efficientnetb0 ->
# global_average_pooling2d -> dropout -> dense
#
# Grad-CAM needs the last convolutional feature map, which is the output of
# the nested efficientnetb0 model, plus the classification head applied on
# top of it.
# ============================================================

base_model = model.get_layer("efficientnetb0")

global_pool = model.get_layer("global_average_pooling2d")

dropout = model.get_layer("dropout")

classifier = model.get_layer("dense")

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Diabetic Retinopathy AI Service",
    version="1.1"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ============================================================
# HOME
# ============================================================


@app.get("/")
def home():
    return {
        "message": "Diabetic Retinopathy AI Service is running",
        "modelPath": MODEL_PATH,
        "modelTrained": MODEL_IS_TRAINED,
        "classes": CLASS_NAMES,
    }

# ============================================================
# HEALTH CHECK
# ============================================================


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "modelTrained": MODEL_IS_TRAINED,
    }

# ============================================================
# PREDICTION + GRAD-CAM
# ============================================================


def compute_gradcam(model_input):
    """
    Returns (predictions, heatmap) for one preprocessed image batch.

    The convolutional output has to be watched explicitly: it is an
    intermediate tensor, not a variable, so without tape.watch() the
    gradient comes back as None.
    """

    with tf.GradientTape() as tape:

        conv_outputs = base_model(
            model_input,
            training=False
        )

        tape.watch(conv_outputs)

        x = global_pool(conv_outputs)

        x = dropout(x, training=False)

        predictions = classifier(x)

        predicted_class = tf.argmax(predictions[0])

        class_score = predictions[0, predicted_class]

    gradients = tape.gradient(class_score, conv_outputs)

    if gradients is None:
        raise HTTPException(
            status_code=500,
            detail="Could not calculate Grad-CAM gradients."
        )

    # Channel importance = mean gradient per feature map.
    pooled_gradients = tf.reduce_mean(
        gradients,
        axis=(0, 1, 2)
    )

    feature_maps = conv_outputs[0]

    heatmap = feature_maps @ pooled_gradients[..., tf.newaxis]

    heatmap = tf.squeeze(heatmap)

    # Keep only evidence that pushed the score up.
    heatmap = tf.maximum(heatmap, 0)

    max_value = tf.reduce_max(heatmap)

    if float(max_value) > 0:
        heatmap = heatmap / max_value

    return predictions, heatmap.numpy()


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

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG images are allowed."
        )

    # --------------------------------------------------------
    # Read image
    # --------------------------------------------------------

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

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
    #
    # EfficientNet does its own rescaling internally, so the raw
    # 0-255 values are fed in - exactly as in train.py.
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
    # Predict + explain
    # --------------------------------------------------------

    predictions, heatmap = compute_gradcam(model_input)

    # --------------------------------------------------------
    # Resize heatmap to the original image
    # --------------------------------------------------------

    heatmap_uint8 = np.uint8(heatmap * 255)

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
    # Save images under one shared id
    # --------------------------------------------------------

    image_id = str(uuid.uuid4())

    names = {
        "original": f"{image_id}_original.png",
        "heatmap": f"{image_id}_heatmap.png",
        "overlay": f"{image_id}_overlay.png",
    }

    cv2.imwrite(
        os.path.join(OUTPUT_DIR, names["original"]),
        original_image
    )

    cv2.imwrite(
        os.path.join(OUTPUT_DIR, names["heatmap"]),
        colored_heatmap
    )

    cv2.imwrite(
        os.path.join(OUTPUT_DIR, names["overlay"]),
        overlay
    )

    # --------------------------------------------------------
    # Prediction information
    # --------------------------------------------------------

    class_id = int(tf.argmax(predictions[0]).numpy())

    confidence = float(predictions[0, class_id].numpy())

    probabilities = {
        CLASS_NAMES[index]: float(predictions[0, index].numpy())
        for index in range(len(CLASS_NAMES))
    }

    # --------------------------------------------------------
    # Return result
    #
    # Paths always use forward slashes so the same value works when the
    # frontend builds an image URL on Windows and on Linux.
    # --------------------------------------------------------

    return {
        "prediction": CLASS_NAMES[class_id],
        "classId": class_id,
        "confidence": confidence,
        "probabilities": probabilities,
        "modelTrained": MODEL_IS_TRAINED,
        "originalImage": f"{OUTPUT_DIR}/{names['original']}",
        "heatmap": f"{OUTPUT_DIR}/{names['heatmap']}",
        "overlay": f"{OUTPUT_DIR}/{names['overlay']}",
    }

# ============================================================
# SERVE GENERATED IMAGE
# ============================================================


@app.get("/generated/{filename}")
def get_generated_image(
    filename: str
):

    # Never let a request escape the output directory.
    safe_name = os.path.basename(filename)

    if safe_name != filename or not safe_name:
        raise HTTPException(
            status_code=400,
            detail="Invalid file name."
        )

    file_path = os.path.join(OUTPUT_DIR, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Image not found."
        )

    return FileResponse(
        file_path,
        media_type="image/png"
    )
