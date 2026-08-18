---
title: Diabetic Retinopathy AI Service
emoji: 👁️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
license: mit
---

# Diabetic Retinopathy AI service

FastAPI + TensorFlow behind the [screening platform](https://github.com/ce24bhumivernekar-beep/Diabetic-Idea).

Runs here rather than on a small VM because TensorFlow needs about 1.5 GB of
memory, which free web tiers elsewhere do not give.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/predict` | grade a fundus image, save Grad-CAM heatmap PNGs |
| POST | `/predict/live` | viewfinder path: grade only, nothing written |
| POST | `/triage/ppg` | heart rate + HRV from fingertip frame samples |
| POST | `/triage/plr` | pupil light reflex from a burst of eye frames |
| POST | `/triage/pallor` | conjunctival pallor index, sclera white-balanced |
| GET | `/generated/{file}` | a previously generated image |
| GET | `/health` | status, and whether the model is trained |

## The model

`models/dr_model.keras` is not in git. The image builds it at startup:

* set the **`AI_MODEL_URL`** secret to a direct link to a trained
  `dr_model.keras` and it is downloaded during the build;
* leave it unset and `bootstrap_model.py` creates an ImageNet backbone with an
  **untrained** head, so the service still starts. `/health` then reports
  `modelTrained: false` and every prediction carries the same flag, which the
  UI shows as a warning.

Measured on the held-out test split of
`youssefedweqd/Diabetic_Retinopathy_Detection` (7,026 images):
quadratic weighted kappa **0.364**, referable-disease sensitivity **64.9%**
at **77.5%** specificity. Useful for prioritising, not for deciding care.
