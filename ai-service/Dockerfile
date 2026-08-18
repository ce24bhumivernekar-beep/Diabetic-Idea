# Diabetic Retinopathy AI service.
#
# The model file is NOT in git, so it is created at build time: the trained
# weights are downloaded if AI_MODEL_URL is set, otherwise a placeholder is
# built so the image still boots and says so.
FROM python:3.11-slim

WORKDIR /app

# opencv needs these; the slim image has neither.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

ARG AI_MODEL_URL=""

RUN mkdir -p models generated \
    && if [ -n "$AI_MODEL_URL" ]; then \
         echo "Fetching trained model..." && \
         curl -fsSL -o models/dr_model.keras "$AI_MODEL_URL"; \
       else \
         echo "No AI_MODEL_URL given - building a placeholder model" && \
         python bootstrap_model.py; \
       fi

ENV PORT=8000

EXPOSE 8000

# One worker: the model is ~200 MB in memory and inference is CPU bound, so a
# second worker would double the memory for no throughput.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1"]
