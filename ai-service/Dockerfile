# AI service image - ONNX Runtime, no TensorFlow.
#
# The exported model ships in the repo (16 MB), so nothing is downloaded at
# build time and the service always starts with the real trained weights.
FROM python:3.11-slim

WORKDIR /app

# opencv-python-headless still needs libglib.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app.py signals.py ./
COPY models/dr_model.onnx models/cam_weights.npz models/training_report.json ./models/

RUN mkdir -p generated

ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1"]
