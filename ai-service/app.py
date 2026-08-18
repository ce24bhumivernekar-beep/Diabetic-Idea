"""
Diabetic Retinopathy AI service.

Two inference paths:

  POST /predict       full screening - prediction + Grad-CAM heatmap PNGs saved
                      to disk. Used when a scan is recorded for doctor review.
  POST /predict/live  live viewfinder - prediction only (optionally a small
                      inline heatmap), nothing written to disk. Built to be
                      called several times per second while the camera runs.

Both share one compiled graph. Running the model eagerly costs ~390 ms per
frame; the same work inside a tf.function costs ~21 ms, which is what makes
the live path possible on CPU.

Run:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

import base64
import json
import os
import time
import uuid

import cv2
import numpy as np
import tensorflow as tf
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from signals import analyze_pallor, analyze_plr, analyze_ppg

# ============================================================
# SETTINGS
# ============================================================

MODEL_PATH = os.getenv("MODEL_PATH", "models/dr_model.keras")
MODEL_INFO_PATH = os.path.join(
    os.path.dirname(MODEL_PATH) or ".",
    "model_info.json",
)

REPORT_PATH = os.path.join(
    os.path.dirname(MODEL_PATH) or ".",
    "training_report.json",
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
    "*",
).split(",")

# Saved images are capped on the long edge: a 12MP phone photo would otherwise
# cost far more in PNG encoding than in inference.
MAX_SAVED_EDGE = int(os.getenv("MAX_SAVED_EDGE", "1024"))

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


def read_training_report():
    """
    How the model actually scored on held-out data. Being trained is not the
    same as being good, so the measured numbers travel with every prediction
    and the UI can be honest about the model's limits.
    """

    if not os.path.exists(REPORT_PATH):
        return None

    try:

        with open(REPORT_PATH, "r", encoding="utf-8") as handle:
            report = json.load(handle)

    except (OSError, ValueError):
        return None

    test = report.get("test", {})

    return {
        "dataset": report.get("dataset"),
        "testImages": report.get("testImages"),
        "accuracy": test.get("accuracy"),
        "quadraticWeightedKappa": test.get("quadraticWeightedKappa"),
        "referableSensitivity": test.get("referableSensitivity"),
        "referableSpecificity": test.get("referableSpecificity"),
    }


MODEL_METRICS = read_training_report()

if not MODEL_IS_TRAINED:
    print()
    print("*" * 62)
    print("WARNING: this model has an UNTRAINED classification head.")
    print("Predictions are placeholders so the pipeline can be demoed.")
    print("Run train.py on the real dataset before any clinical use.")
    print("*" * 62)
    print()

# ============================================================
# COMPILED INFERENCE
#
# The saved model is: input -> augmentation -> efficientnetb0 ->
# global_average_pooling2d -> dropout -> dense
#
# Grad-CAM needs the last convolutional feature map, which is the output of
# the nested efficientnetb0 model, plus the classification head on top of it.
# ============================================================

base_model = model.get_layer("efficientnetb0")

global_pool = model.get_layer("global_average_pooling2d")

dropout = model.get_layer("dropout")

classifier = model.get_layer("dense")

INPUT_SIGNATURE = [
    tf.TensorSpec(
        shape=(1, IMG_SIZE, IMG_SIZE, 3),
        dtype=tf.float32,
    )
]


@tf.function(input_signature=INPUT_SIGNATURE)
def infer(model_input):
    """Class probabilities only. This is the live path."""

    features = base_model(model_input, training=False)

    pooled = global_pool(features)

    return classifier(dropout(pooled, training=False))


@tf.function(input_signature=INPUT_SIGNATURE)
def infer_with_cam(model_input):
    """
    Class probabilities plus the Grad-CAM map for the winning class.

    The convolutional output is watched explicitly: it is an intermediate
    tensor, not a variable, so without tape.watch() the gradient is None.
    """

    with tf.GradientTape() as tape:

        features = base_model(model_input, training=False)

        tape.watch(features)

        pooled = global_pool(features)

        predictions = classifier(
            dropout(pooled, training=False)
        )

        predicted_class = tf.argmax(predictions[0])

        class_score = predictions[0, predicted_class]

    gradients = tape.gradient(class_score, features)

    # Channel importance = mean gradient per feature map.
    weights = tf.reduce_mean(gradients, axis=(0, 1, 2))

    heatmap = tf.squeeze(
        features[0] @ weights[..., tf.newaxis]
    )

    # Keep only evidence that pushed the score up, then normalise.
    heatmap = tf.maximum(heatmap, 0)

    peak = tf.reduce_max(heatmap)

    heatmap = tf.cond(
        peak > 0,
        lambda: heatmap / peak,
        lambda: heatmap,
    )

    return predictions, heatmap


def warm_up():
    """
    Trace both graphs at import time so the first real request is not the one
    that pays for compilation.
    """

    blank = tf.zeros(
        (1, IMG_SIZE, IMG_SIZE, 3),
        dtype=tf.float32,
    )

    started = time.perf_counter()

    infer(blank)
    infer_with_cam(blank)

    print(
        "Graphs compiled in "
        f"{round((time.perf_counter() - started) * 1000)} ms"
    )

    # Steady-state cost, measured in this process so the numbers reflect what
    # a request will actually pay.
    samples = []

    for _ in range(5):
        tick = time.perf_counter()
        infer(blank)
        samples.append((time.perf_counter() - tick) * 1000)

    samples.sort()

    print(
        "In-process inference median "
        f"{round(samples[len(samples) // 2])} ms "
        f"({[round(sample) for sample in samples]})"
    )

    print("TF intra-op threads:", tf.config.threading.get_intra_op_parallelism_threads())
    print("TF inter-op threads:", tf.config.threading.get_inter_op_parallelism_threads())


warm_up()

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Diabetic Retinopathy AI Service",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ============================================================
# HELPERS
# ============================================================


def decode_image(contents):

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    buffer = np.frombuffer(contents, dtype=np.uint8)

    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image."
        )

    return image


def to_model_input(image_bgr):
    """
    EfficientNet rescales internally, so raw 0-255 values go in - exactly as
    in train.py.
    """

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE))

    return tf.constant(
        np.expand_dims(resized.astype(np.float32), axis=0)
    )


def check_content_type(file):

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


def summarise(predictions):

    values = predictions[0].numpy()

    class_id = int(np.argmax(values))

    return {
        "prediction": CLASS_NAMES[class_id],
        "classId": class_id,
        "confidence": float(values[class_id]),
        "probabilities": {
            CLASS_NAMES[index]: float(values[index])
            for index in range(len(CLASS_NAMES))
        },
        "modelTrained": MODEL_IS_TRAINED,
        "modelMetrics": MODEL_METRICS,
    }


def colour_heatmap(heatmap, width, height):

    scaled = np.uint8(heatmap * 255)

    scaled = cv2.resize(scaled, (width, height))

    return cv2.applyColorMap(scaled, cv2.COLORMAP_JET)


def limit_size(image):
    """Keeps saved PNGs sane without touching what the model sees."""

    height, width = image.shape[:2]

    longest = max(height, width)

    if longest <= MAX_SAVED_EDGE:
        return image

    scale = MAX_SAVED_EDGE / float(longest)

    return cv2.resize(
        image,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_AREA,
    )

# ============================================================
# INFORMATION
# ============================================================


@app.get("/")
def home():
    return {
        "message": "Diabetic Retinopathy AI Service is running",
        "modelPath": MODEL_PATH,
        "modelTrained": MODEL_IS_TRAINED,
        "classes": CLASS_NAMES,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "modelTrained": MODEL_IS_TRAINED,
        "modelMetrics": MODEL_METRICS,
    }

# ============================================================
# LIVE PREDICTION - no disk, no PNG encoding
# ============================================================


@app.post("/predict/live")
async def predict_live(
    file: UploadFile = File(...),
    heatmap: str = Form("false"),
):
    """
    Built for the camera viewfinder: one small frame in, grade out.

    heatmap=true also returns a 64x64 grayscale Grad-CAM as a base64 PNG,
    small enough to draw over the video without saving anything.
    """

    check_content_type(file)

    started = time.perf_counter()

    image = decode_image(await file.read())

    model_input = to_model_input(image)

    decoded_ms = (time.perf_counter() - started) * 1000

    want_heatmap = str(heatmap).lower() in ("1", "true", "yes")

    inference_started = time.perf_counter()

    if want_heatmap:
        predictions, cam = infer_with_cam(model_input)
    else:
        predictions = infer(model_input)
        cam = None

    inference_ms = (time.perf_counter() - inference_started) * 1000

    result = summarise(predictions)

    if cam is not None:

        cam_small = cv2.resize(
            np.uint8(cam.numpy() * 255),
            (64, 64),
            interpolation=cv2.INTER_LINEAR,
        )

        ok, encoded = cv2.imencode(".png", cam_small)

        if ok:
            result["heatmapInline"] = (
                "data:image/png;base64,"
                + base64.b64encode(encoded.tobytes()).decode("ascii")
            )

    result["timings"] = {
        "decodeMs": round(decoded_ms, 1),
        "inferenceMs": round(inference_ms, 1),
        "totalMs": round((time.perf_counter() - started) * 1000, 1),
    }

    return result

# ============================================================
# FULL PREDICTION + GRAD-CAM, SAVED FOR REVIEW
# ============================================================


@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    check_content_type(file)

    started = time.perf_counter()

    original_image = limit_size(
        decode_image(await file.read())
    )

    model_input = to_model_input(original_image)

    inference_started = time.perf_counter()

    predictions, cam = infer_with_cam(model_input)

    inference_ms = (time.perf_counter() - inference_started) * 1000

    render_started = time.perf_counter()

    colored_heatmap = colour_heatmap(
        cam.numpy(),
        original_image.shape[1],
        original_image.shape[0],
    )

    overlay = cv2.addWeighted(
        original_image,
        0.60,
        colored_heatmap,
        0.40,
        0
    )

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

    render_ms = (time.perf_counter() - render_started) * 1000

    result = summarise(predictions)

    # Forward slashes always, so the same value builds a URL on any host.
    result.update({
        "originalImage": f"{OUTPUT_DIR}/{names['original']}",
        "heatmap": f"{OUTPUT_DIR}/{names['heatmap']}",
        "overlay": f"{OUTPUT_DIR}/{names['overlay']}",
        "timings": {
            "inferenceMs": round(inference_ms, 1),
            "renderMs": round(render_ms, 1),
            "totalMs": round((time.perf_counter() - started) * 1000, 1),
        },
    })

    return result

# ============================================================
# CAMERA-ONLY TRIAGE MEASUREMENTS
#
# None of these look at the retina. They measure what a bare phone camera can
# actually see, to decide who needs a retinal exam first.
# ============================================================


@app.post("/triage/ppg")
async def triage_ppg(payload: dict = Body(...)):
    """
    Heart rate and heart-rate variability from a fingertip recording.

    The browser sends the per-frame mean red level, not the video, so the
    upload stays a few kilobytes.
    """

    samples = payload.get("samples")

    if not isinstance(samples, list) or len(samples) < 60:
        raise HTTPException(
            status_code=400,
            detail="Send at least 60 frame samples.",
        )

    return analyze_ppg(
        samples,
        payload.get("timestampsMs"),
    )


@app.post("/triage/plr")
async def triage_plr(
    frames: list[UploadFile] = File(...),
    timestampsMs: str = Form(...),
    lightOnIndex: int = Form(0),
):
    """Pupil response, from a burst of eye close-ups around the torch firing."""

    try:
        stamps = [float(value) for value in json.loads(timestampsMs)]
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="timestampsMs must be a JSON array of numbers.",
        )

    if len(stamps) != len(frames):
        raise HTTPException(
            status_code=400,
            detail="One timestamp is required per frame.",
        )

    decoded = []

    for frame in frames:
        decoded.append(decode_image(await frame.read()))

    return analyze_plr(decoded, stamps, lightOnIndex)


@app.post("/triage/pallor")
async def triage_pallor(
    file: UploadFile = File(...),
    conjunctivaBox: str = Form(...),
    scleraBox: str = Form(...),
):
    """Conjunctival pallor index, white-balanced against the sclera."""

    check_content_type(file)

    image = decode_image(await file.read())

    try:
        conjunctiva = json.loads(conjunctivaBox)
        sclera = json.loads(scleraBox)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Boxes must be JSON arrays [x, y, w, h].",
        )

    if len(conjunctiva) != 4 or len(sclera) != 4:
        raise HTTPException(
            status_code=400,
            detail="Boxes must be [x, y, w, h].",
        )

    return analyze_pallor(image, conjunctiva, sclera)


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
