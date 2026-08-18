# Diabetic Retinopathy Screening Platform

SIH project for diabetic retinopathy screening using AI and explainable heatmaps.

A patient uploads a retinal fundus image, an EfficientNetB0 model grades the
diabetic retinopathy severity, Grad-CAM shows which regions drove the decision,
and a doctor reviews and signs off every result.

---

## Pipeline

```
  React + Vite                Spring Boot 4 (Java 17+)            FastAPI + TensorFlow
  localhost:5173  ──JWT──▶    localhost:8080          ──POST──▶   localhost:8000
       │                            │  /predict (multipart)            │
       │                            ▼                                  │
       │                        MongoDB                                │
       │                     localhost:27017                           │
       │                   db: diabetic_retinopathy                    │
       │                                                               │
       └──────────── GET /generated/<file>.png (heatmap images) ────────┘
```

* Every data call goes through the Spring Boot API. The browser talks to the AI
  service only to fetch the generated PNGs.
* The API holds the JWT gate, the ownership rules and the Mongo documents.
* The AI service is stateless: image in, prediction + three PNGs out.

### Request flow of one screening

1. `POST /api/auth/register` or `/login` → JWT (role `PATIENT` / `DOCTOR`).
2. `POST /api/patients` → clinical profile, linked to the account **from the token**.
3. `POST /api/screenings/analyze` (multipart) → the API forwards the image to
   `POST :8000/predict`, stores prediction + class probabilities + image paths in
   Mongo with status `PENDING_REVIEW`, and returns the saved screening.
4. `GET /api/screenings/patient/{id}` → the patient's own history.
5. `GET /api/doctor/screenings` → every screening, enriched with patient
   name / age / gender for the dashboard.
6. `PUT /api/doctor/screening/{id}/review` → decision + remarks, status `REVIEWED`.

---

## Prerequisites

| Component | Needs | Notes |
|---|---|---|
| Backend | JDK 17+ | Maven comes from `backend/mvnw` |
| AI service | **Python 3.9 – 3.12** | TensorFlow has no wheels for 3.13 / 3.14 |
| Frontend | Node 18+ | |
| Database | MongoDB 6+ | must be listening on `localhost:27017` |

---

## Setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

This creates the Python 3.11 venv, installs the AI dependencies, creates a
runnable model file if none exists, installs the node modules and compiles the
backend.

Manual equivalent:

```powershell
# AI service
py -3.11 -m venv ai-service\venv
ai-service\venv\Scripts\python -m pip install -r ai-service\requirements.txt
cd ai-service; ..\ai-service\venv\Scripts\python bootstrap_model.py; cd ..

# frontend
cd frontend; npm install; copy .env.example .env; cd ..

# backend
cd backend; .\mvnw.cmd -DskipTests compile; cd ..
```

## Run

```powershell
powershell -ExecutionPolicy Bypass -File .\run-all.ps1
```

Or one service per terminal:

```powershell
# 1. AI service
cd ai-service; .\venv\Scripts\python -m uvicorn app:app --port 8000

# 2. API
cd backend; .\mvnw.cmd -DskipTests spring-boot:run

# 3. Frontend
cd frontend; npm run dev
```

Then open <http://localhost:5173>.

### Is everything connected?

```powershell
curl http://localhost:8080/api/health
# {"backend":"UP","mongodb":"UP","aiService":"UP"}
```

`DOWN` on `aiService` means uvicorn is not running; `DOWN` on `mongodb` means the
MongoDB service is stopped.

---

## Using it from a phone (patient) with live doctor review

```powershell
powershell -ExecutionPolicy Bypass -File .\run-mobile.ps1
```

It prints the address to open on the phone (for example `http://192.168.0.101:5173`),
opens the Windows Firewall on ports 5173 / 8080 / 8000 for private networks, and
starts all three services. Run it **as Administrator** the first time, otherwise
the firewall rules cannot be created and the phone will not connect.

The phone needs no configuration: the frontend derives the API and AI-service
hosts from the address the page was opened on, so `frontend/.env` can stay empty.

### Camera capture

The screening page offers two capture paths and picks one automatically:

| Path | How it works | Where it works |
|---|---|---|
| **Phone camera** | `<input capture="environment">` hands off to the phone camera app and returns the photo | anywhere, including plain `http://192.168.x.x` |
| **Live camera** | `getUserMedia` preview with a shutter button, front/rear switch, frame grabbed to a 92%-quality JPEG | only in a **secure context**: `localhost` or HTTPS |

Browsers refuse `getUserMedia` on a plain-HTTP LAN address, so on a phone over
http the page shows the Phone-camera path and says why. To get the live in-page
camera on a phone, serve the app over HTTPS. With Tailscale installed:

```powershell
tailscale serve --bg 5173      # then open the https://<machine>.<tailnet>.ts.net URL
```

`*.ts.net` origins are already in the CORS pattern list.

> A phone camera on its own photographs the front of the eye. A gradable retinal
> image needs a fundus lens attachment or a fundus camera feeding the phone - the
> software path is the same either way.

### Live updates

Both dashboards hold a Server-Sent Events connection to
`GET /api/events/stream?token=<jwt>` and show a **Live** badge:

| Event | Sent to | Effect |
|---|---|---|
| `screening-created` | every connected doctor | the new scan appears in the queue with a toast |
| `screening-reviewed` | the patient who owns the scan, and doctors | the sign-off appears in the patient history |

`EventSource` cannot set an `Authorization` header, so this one route also
accepts the JWT as a `token` query parameter - `JwtAuthenticationFilter` allows
that for `/api/events/**` and nowhere else. A comment frame every 20 seconds
keeps mobile connections from being dropped, and the client falls back to
polling every 15 seconds if the stream cannot be held open.

Events are held in memory in `ScreeningEventService`, which is correct for one
instance. Behind two or more instances they would need a shared broker (Redis
pub/sub, or Mongo change streams).

---

## Stage 1: camera-only triage (no fundus lens)

A bare phone camera cannot photograph the retina. Light has to enter the pupil,
reflect off the fundus and come back out, which needs a condensing lens and
coaxial illumination. So the phone-only part of this project does not try to
grade retinopathy - it measures what a camera *can* see and decides **who needs
a retinal exam first**, which is the real bottleneck when there are far more
diabetic patients than fundus cameras.

| Measurement | How | Why it matters | Accuracy on synthetic signals |
|---|---|---|---|
| Heart rate + HRV | fingertip over the lens and flash, 30 s | low HRV is a marker of cardiac autonomic neuropathy | **0.05 bpm** mean error, 48-132 bpm |
| Pupil light reflex | eye close-up while the torch fires | a blunted, slow reflex is an early autonomic sign | **0.33 mm** mean error on pupil diameter |
| Conjunctival pallor | photo of the lower lid | anaemia accelerates retinopathy | **0** drift between warm and neutral lighting |

Two tricks remove the need for any extra hardware:

* the **iris is the ruler** - horizontal visible iris diameter is 11.7 mm in
  adults, so pixels convert to millimetres in any photo, at any distance;
* the **sclera is the white card** - dividing the lid colour by the sclera
  colour cancels the phone's white balance and the room's lighting.

Run the accuracy checks yourself:

```powershell
cd ai-service
.env\Scripts\python test_signals.py     # 19 checks, each with a known answer
```

### The score

`TriageScoringService` adds points from the questionnaire (duration of
diabetes, HbA1c, blood pressure, age, smoking, vision symptoms) and from any
measurement that came back reliable, then bands the total:

| Score | Priority | Retinal exam within |
|---|---|---|
| 60+ | URGENT | 1 week |
| 40-59 | HIGH | 4 weeks |
| 20-39 | MODERATE | 6 months |
| under 20 | ROUTINE | 12 months |

Every point comes back with the sentence that explains it, so a doctor can
argue with one line instead of with a black box. **A measurement that fails its
own quality check is excluded and listed as "not counted" - it never becomes a
confident-looking number.** The weights follow the direction of established
risk factors but have not been fitted to outcome data; the output orders a
queue, it does not estimate a probability.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/triage/ppg` | frame samples in, heart rate + HRV out |
| POST | `/api/triage/plr` | eye frames in, pupil response in mm out |
| POST | `/api/triage/pallor` | lid photo + two boxes in, pallor index out |
| POST | `/api/triage` | store an assessment, score it, notify doctors |
| GET | `/api/triage/patient/{id}` | a patient's assessments |
| GET | `/api/doctor/triage` | the whole queue, newest first |

The three measurement endpoints store nothing, so a bad recording can be
retaken freely. Only `POST /api/triage` writes a record and raises a
`triage-recorded` event to the doctors.

### Stage 2 stays as it is

Retinal grading still runs on a real retinal image, from a clinic fundus camera
or a **clip-on 20D condensing lens** (roughly Rs 400-900), which is the cheapest
honest way to put a retina in front of a phone.

---

## The model

`ai-service/models/dr_model.keras` is **not** in git (see `.gitignore`).

`bootstrap_model.py` writes a model with the same architecture `train.py` builds
— ImageNet EfficientNetB0 backbone, **randomly initialised classification
head** — purely so the pipeline can be started and demoed. It also writes
`models/model_info.json` with `"trained": false`, which `/health` and `/predict`
report back as `modelTrained: false`.

Predictions from that placeholder are meaningless. To get a real model:

```powershell
cd ai-service
# put the APTOS 2019 data in data/train.csv + data/train_images/
.\venv\Scripts\python prepare_dataset.py    # stratified 70/15/15 split
.\venv\Scripts\python check_dataset.py      # per-class counts
.\venv\Scripts\python train.py              # writes models/dr_model.keras
.\venv\Scripts\python evaluate.py           # report + confusion matrix
```

Training overwrites the placeholder, and `model_info.json` should then be
deleted so the service stops flagging the model as untrained.

Classes: `0 No DR`, `1 Mild`, `2 Moderate`, `3 Severe`, `4 Proliferative`.

---

## Configuration

Nothing is hardcoded to a host any more.

**`backend/src/main/resources/application.properties`** (all overridable by env var):

| Property | Env var | Default |
|---|---|---|
| `server.port` | `SERVER_PORT` | `8080` |
| `spring.data.mongodb.uri` | `MONGODB_URI` | `mongodb://localhost:27017/diabetic_retinopathy` |
| `ai.service.base-url` | `AI_SERVICE_URL` | `http://localhost:8000` |
| `ai.service.timeout-seconds` | `AI_SERVICE_TIMEOUT` | `120` |
| `app.cors.allowed-origin-patterns` | `CORS_ALLOWED_ORIGIN_PATTERNS` | localhost + private LAN ranges + `*.ts.net` |
| `app.jwt.secret` | `JWT_SECRET` | dev secret — **change for any deployment** |
| `app.jwt.expiration-ms` | `JWT_EXPIRATION_MS` | `86400000` (24h) |

**`frontend/.env`** (copy from `.env.example`) is optional - leave it empty and
both hosts are derived from the address the page was opened on, which is what
makes phone access work with no edits:

```
# VITE_API_URL=http://localhost:8080
# VITE_AI_URL=http://localhost:8000
```

**`ai-service`** env vars: `MODEL_PATH`, `OUTPUT_DIR`, `CORS_ALLOWED_ORIGINS`.

---

## API

Public: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`.
Everything else needs `Authorization: Bearer <token>`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | create account (`role`: `PATIENT`/`DOCTOR`) |
| POST | `/api/auth/login` | – | get a token |
| POST | `/api/patients` | PATIENT | create own profile (one per account) |
| GET | `/api/patients/user/{userId}` | owner or DOCTOR | profile by account id |
| GET | `/api/patients` | DOCTOR | all profiles |
| POST | `/api/screenings/analyze` | PATIENT (own profile) | upload image, run AI |
| GET | `/api/screenings/patient/{id}` | owner or DOCTOR | history, newest first |
| GET | `/api/doctor/screenings` | DOCTOR | all screenings + patient details |
| GET | `/api/doctor/screening/{id}` | DOCTOR | one screening |
| PUT | `/api/doctor/screening/{id}/review` | DOCTOR | `?decision=&remarks=&doctorName=` |
| GET | `/api/events/stream` | any | SSE live stream, token via `?token=` |

Errors are always JSON, so the UI can show the reason:

```json
{ "error": "Doctor access required.", "status": 403 }
```

| Situation | Status |
|---|---|
| bad credentials / missing or expired token | 401 |
| wrong role, or another patient's data | 403 |
| unknown patient / screening | 404 |
| email already registered, profile already exists | 409 |
| image over 20MB | 413 |
| AI service down or rejecting the image | 502 |

---

## Layout

```
ai-service/         FastAPI + TensorFlow
  app.py            /predict (prediction + Grad-CAM), /generated/{file}, /health
  bootstrap_model.py creates a runnable model when no trained one exists
  prepare_dataset.py train.py  evaluate.py  gradcam.py  check_dataset.py
  models/           dr_model.keras (ignored by git)
  generated/        original / heatmap / overlay PNGs (ignored by git)

backend/            Spring Boot 4, MongoDB
  controller/       auth, patients, screenings, doctor, health
  client/           AiServiceClient - the only caller of the AI service
  security/         JwtService, JwtAuthenticationFilter
  config/           CorsConfig (runs before the JWT filter), PasswordConfig
  exception/        ApiException + GlobalExceptionHandler (JSON errors)
  dto/              AuthResponse, AiPredictionResponse, ScreeningView

frontend/           React 19 + Vite
  src/config.js     API_URL / AI_URL derived from the page host, auth + error helpers
  src/components/   CameraCapture (live + phone camera), ScreeningReport
  src/hooks/        useLiveEvents (SSE with polling fallback)
  src/pages/        landing, patient + doctor auth, screening, result, dashboards
```

## Notes for deployment

* Change `JWT_SECRET`; the default is a committed dev value.
* Generated PNGs live on the AI service disk. For more than one instance, move
  them to shared storage or object storage.
* Passwords are BCrypt hashed. The screening images themselves are stored
  unencrypted on disk — worth revisiting before handling real patient data.
