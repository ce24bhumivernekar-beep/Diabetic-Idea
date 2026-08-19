"""
Diabetic Retinopathy AI service.

Two inference paths:

  POST /predict       full screening - prediction + Grad-CAM heatmap PNGs saved
                      to disk. Used when a scan is recorded for doctor review.
  POST /predict/live  live viewfinder - prediction only (optionally a small
                      inline heatmap), nothing written to disk. Built to be
                      called several times per second while the camera runs.

Serving runs on ONNX Runtime, not TensorFlow: TF is ~600 MB installed and
needs over a gigabyte at rest, which fits no free hosting tier, while
onnxruntime is ~40 MB and serves the same weights.

The heatmap survives that change because the network ends in
GlobalAveragePooling -> Dropout -> Dense, and for exactly that shape the
weights Grad-CAM derives from gradients are algebraically identical to the
Dense layer's own weights. So the explanation needs a forward pass only.
Checked against the TF version: probabilities agree to 1e-6, heatmaps
correlate at 0.97. TensorFlow is still used for training and for the export
(see requirements-train.txt).

Run:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

import base64
import json
import os
import time

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from quality import assess as assess_quality
from signals import analyze_pallor, analyze_plr, analyze_ppg

# ============================================================
# SETTINGS
# ============================================================

MODEL_DIR = os.getenv("MODEL_DIR", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "dr_model.onnx")
CAM_PATH = os.path.join(MODEL_DIR, "cam_weights.npz")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.json")

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
MAX_SAVED_EDGE = int(os.getenv("MAX_SAVED_EDGE", "900"))

# Small enough that three per screening sit inside a free database tier, large
# enough to read a retina.
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "82"))

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# LOAD MODEL
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise SystemExit(
        f"Model not found at {MODEL_PATH}. Export one with export_onnx.py."
    )

print(f"Loading {MODEL_PATH} ...")

session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])

INPUT_NAME = session.get_inputs()[0].name

# The Dense kernel doubles as the CAM weights - see infer().
CAM_KERNEL = np.load(CAM_PATH)["kernel"]

print("Model loaded.")


def read_training_report():
    """How the model scored on held-out data; trained is not the same as good."""

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
        # The operating point actually used to refer, which is the pair of
        # numbers a report should quote - not the argmax pair above.
        "screening": report.get("screening"),
    }


MODEL_METRICS = read_training_report()


def read_screening_threshold():
    """
    The cut that decides referral.

    Taking the most likely of five grades answers the wrong question. A
    screening programme asks whether this person needs a specialist, which is
    one threshold on P(grade >= 2) - and where that threshold sits is a
    clinical choice about how many missed cases are acceptable, not something
    argmax should decide by accident.
    """

    if not os.path.exists(REPORT_PATH):
        return None

    try:
        with open(REPORT_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle).get("screening")
    except (OSError, ValueError):
        return None


SCREENING = read_screening_threshold()

MODEL_IS_TRAINED = MODEL_METRICS is not None


def infer(model_input, want_heatmap=True):
    """
    One forward pass gives both the probabilities and the feature map.

    The heatmap is the feature map weighted by the Dense row of the winning
    class. For a GlobalAveragePooling + Dense head that is algebraically the
    same as Grad-CAM, so no autodiff - and no TensorFlow - is needed at serve
    time. Checked against the TF implementation: probabilities agree to 1e-6
    and the heatmaps correlate at 0.97.
    """

    outputs = session.run(None, {INPUT_NAME: model_input})

    features = next(o for o in outputs if o.ndim == 4)[0]
    probabilities = next(o for o in outputs if o.ndim == 2)[0]

    if not want_heatmap:
        return probabilities, None

    heatmap = features @ CAM_KERNEL[:, int(probabilities.argmax())]

    heatmap = np.maximum(heatmap, 0)

    peak = float(heatmap.max())

    if peak > 0:
        heatmap = heatmap / peak

    return probabilities, heatmap


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

    return np.expand_dims(resized.astype(np.float32), axis=0)


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

    values = np.asarray(predictions)

    class_id = int(np.argmax(values))

    referable_probability = float(values[2:].sum())

    summary = {
        "prediction": CLASS_NAMES[class_id],
        "classId": class_id,
        "confidence": float(values[class_id]),
        "probabilities": {
            CLASS_NAMES[index]: float(values[index])
            for index in range(len(CLASS_NAMES))
        },
        "referableProbability": round(referable_probability, 4),
        "modelTrained": MODEL_IS_TRAINED,
        "modelMetrics": MODEL_METRICS,
    }

    if SCREENING:
        threshold = SCREENING.get("referableThreshold", 0.5)

        summary["referable"] = bool(referable_probability >= threshold)

        summary["referralBasis"] = {
            "threshold": threshold,
            "sensitivity": SCREENING.get("sensitivityAtThreshold"),
            "specificity": SCREENING.get("specificityAtThreshold"),
        }

    return summary


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

    quality = assess_quality(image)

    # Nothing to grade if there is no retina in the frame. Returning a
    # confident grade for a picture of a wall or a thumb is exactly the
    # failure this gate exists to prevent, and on the live view it is also
    # what tells the patient how to move.
    if not quality["eyeDetected"]:
        return {
            "ok": False,
            "quality": quality,
            "timings": {
                "totalMs": round((time.perf_counter() - started) * 1000, 1)
            },
        }

    model_input = to_model_input(image)

    decoded_ms = (time.perf_counter() - started) * 1000

    want_heatmap = str(heatmap).lower() in ("1", "true", "yes")

    inference_started = time.perf_counter()

    if want_heatmap:
        predictions, cam = infer(model_input, want_heatmap=True)
    else:
        predictions, cam = infer(model_input, want_heatmap=False)

    inference_ms = (time.perf_counter() - inference_started) * 1000

    result = summarise(predictions)

    result["ok"] = True
    result["quality"] = quality

    if cam is not None:

        cam_small = cv2.resize(
            np.uint8(cam * 255),
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

    # Judge the photograph before grading it. The verdict is stored with the
    # screening either way - a grade nobody could have made from this image
    # must not reach a report looking authoritative.
    quality = assess_quality(original_image)

    model_input = to_model_input(original_image)

    inference_started = time.perf_counter()

    predictions, cam = infer(model_input, want_heatmap=True)

    inference_ms = (time.perf_counter() - inference_started) * 1000

    render_started = time.perf_counter()

    colored_heatmap = colour_heatmap(
        cam,
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

    def encode(image):
        """
        The images travel back in the response instead of being written to
        disk. A container filesystem does not survive a restart, so every
        screening older than the current instance used to lose its pictures
        while the database went on pointing at them.

        JPEG rather than PNG: these are photographs, and three of them per
        screening have to fit comfortably in a free database tier.
        """

        ok, buffer = cv2.imencode(
            ".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
        )

        if not ok:
            return None

        return base64.b64encode(buffer.tobytes()).decode("ascii")

    result = summarise(predictions)

    result["quality"] = quality

    result.update({
        "originalImage": encode(original_image),
        "heatmap": encode(colored_heatmap),
        "overlay": encode(overlay),
        "timings": {
            "inferenceMs": round(inference_ms, 1),
            "renderMs": round((time.perf_counter() - render_started) * 1000, 1),
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


@app.post("/quality")
async def image_quality(file: UploadFile = File(...)):
    """Is there an eye here, and is it good enough to grade?"""

    check_content_type(file)

    return assess_quality(decode_image(await file.read()))


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
