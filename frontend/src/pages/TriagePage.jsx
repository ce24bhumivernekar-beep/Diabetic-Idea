import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import BackLink from "../components/BackLink";
import { API_URL, apiError, authHeaders } from "../config";
import { useAuth } from "../context/auth";

/**
 * Camera-only screening.
 *
 * Four steps, none of which need a fundus lens:
 *   1  fingertip on the camera  -> heart rate and heart-rate variability
 *   2  light into the eye       -> pupil constriction, in millimetres
 *   3  photo of the lower lid   -> conjunctival pallor
 *   4  a few questions          -> the known risk factors
 *
 * The result is a place in the queue for a retinal exam, not a diagnosis of
 * retinopathy. Only a retinal image can give that, and that still needs
 * optics in front of the camera.
 */

const PPG_SECONDS = 30;
const PLR_FRAMES = 16;
const PLR_INTERVAL_MS = 70;

// Fractions of the preview, so the guides land in the same place on any phone.
const CONJUNCTIVA_GUIDE = { x: 0.2, y: 0.58, w: 0.6, h: 0.22 };
const SCLERA_GUIDE = { x: 0.3, y: 0.2, w: 0.4, h: 0.16 };

const STEPS = [
  { key: "ppg", title: "Pulse" },
  { key: "plr", title: "Pupil" },
  { key: "pallor", title: "Eyelid" },
  { key: "questions", title: "Questions" },
];

function post(path, options) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    ...options,
  });
}

async function readResult(response, fallback) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(apiError(text, fallback));
  }

  return JSON.parse(text);
}

function TriagePage() {
  const { patient } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [ppg, setPpg] = useState(null);
  const [plr, setPlr] = useState(null);
  const [pallor, setPallor] = useState(null);

  const [progress, setProgress] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [screenFlash, setScreenFlash] = useState(false);

  const [form, setForm] = useState({
    age: patient.age ? String(patient.age) : "",
    yearsWithDiabetes: "",
    hba1c: "",
    systolicBp: "",
    smoker: false,
    visionSymptoms: false,
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // ---------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchOn(false);
  }, []);

  const startCamera = useCallback(async (facing = "environment") => {
    stopCamera();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    return stream;
  }, [stopCamera]);

  /**
   * The torch is the light source for both the pulse and the pupil steps.
   * Laptops have no torch, so a white screen stands in - which is also the
   * right light source when the front camera is used.
   */
  const setLight = useCallback(async (on) => {
    const track = streamRef.current
      ? streamRef.current.getVideoTracks()[0]
      : null;

    const capabilities =
      track && track.getCapabilities ? track.getCapabilities() : {};

    if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: on }] });
        setTorchOn(on);
        return "torch";
      } catch {
        // fall through to the screen
      }
    }

    setScreenFlash(on);

    return "screen";
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const grab = useCallback((size = 320) => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      return null;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;

    canvas.width = size;
    canvas.height = size;

    const side = Math.min(video.videoWidth, video.videoHeight);

    canvas
      .getContext("2d")
      .drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );

    return canvas;
  }, []);

  // ---------------------------------------------------------
  // STEP 1 - PULSE
  // ---------------------------------------------------------

  const recordPulse = async () => {
    setError("");
    setBusy("Recording your pulse");
    setProgress(0);

    try {
      await startCamera("environment");
      await setLight(true);

      const samples = [];
      const timestamps = [];
      const started = performance.now();

      // Sample the red channel of a small centre patch: a fingertip over the
      // lens turns the whole frame red, and the pulse is the ripple on it.
      while (performance.now() - started < PPG_SECONDS * 1000) {
        const canvas = grab(64);

        if (canvas) {
          const { data } = canvas
            .getContext("2d")
            .getImageData(16, 16, 32, 32);

          let red = 0;

          for (let index = 0; index < data.length; index += 4) {
            red += data[index];
          }

          const mean = red / (data.length / 4);

          samples.push(mean);
          timestamps.push(performance.now() - started);

          // Show the level live: a covered lens with the light on sits high.
          // Without this the user has no idea whether the finger is placed
          // correctly until 30 seconds have already been wasted.
          setLevel(Math.round(mean));
        }

        setProgress(
          Math.min(
            100,
            ((performance.now() - started) / (PPG_SECONDS * 1000)) * 100
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 33));
      }

      await setLight(false);
      stopCamera();

      // A fingertip lit by the torch is bright red. Anything dark means the
      // lens was not covered, or the device has no usable light.
      const average =
        samples.reduce((total, value) => total + value, 0) /
        Math.max(samples.length, 1);

      if (average < 40) {
        throw new Error(
          "The camera saw almost no light (level " +
            Math.round(average) +
            "). Use a phone's rear camera, cover both the lens and the " +
            "flash with your fingertip, and try again."
        );
      }

      setBusy("Analysing");

      const result = await readResult(
        await post("/api/triage/ppg", {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ samples, timestampsMs: timestamps }),
        }),
        "Could not analyse the pulse recording."
      );

      if (!result.ok) {
        throw new Error(result.reason || "Recording was not usable.");
      }

      setPpg(result);
      setStep(1);
    } catch (recordError) {
      setError(recordError.message || "Could not record the pulse.");
      stopCamera();
    } finally {
      setBusy("");
      setProgress(0);
      setScreenFlash(false);
    }
  };

  // ---------------------------------------------------------
  // STEP 2 - PUPIL
  // ---------------------------------------------------------

  const recordPupil = async () => {
    setError("");
    setBusy("Hold still - the light will flash");
    setProgress(0);

    try {
      await startCamera("environment");
      await setLight(false);

      // Let the pupil settle in the dark before the light fires.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const frames = [];
      const timestamps = [];
      const started = performance.now();

      const lightOnIndex = Math.floor(PLR_FRAMES / 3);

      for (let index = 0; index < PLR_FRAMES; index += 1) {
        if (index === lightOnIndex) {
          await setLight(true);
        }

        const canvas = grab(320);

        if (canvas) {
          const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.85)
          );

          frames.push(blob);
          timestamps.push(Math.round(performance.now() - started));
        }

        setProgress(((index + 1) / PLR_FRAMES) * 100);

        await new Promise((resolve) =>
          setTimeout(resolve, PLR_INTERVAL_MS)
        );
      }

      await setLight(false);
      stopCamera();

      setBusy("Measuring the pupil");

      const body = new FormData();

      frames.forEach((blob, index) =>
        body.append("frames", blob, `frame-${index}.jpg`)
      );

      body.append("timestampsMs", JSON.stringify(timestamps));
      body.append("lightOnIndex", String(lightOnIndex));

      const result = await readResult(
        await post("/api/triage/plr", { body }),
        "Could not measure the pupil."
      );

      if (!result.ok) {
        throw new Error(result.reason || "Could not track the pupil.");
      }

      setPlr(result);
      setStep(2);
    } catch (recordError) {
      setError(recordError.message || "Could not measure the pupil.");
      stopCamera();
    } finally {
      setBusy("");
      setProgress(0);
      setScreenFlash(false);
    }
  };

  // ---------------------------------------------------------
  // STEP 3 - EYELID
  // ---------------------------------------------------------

  const capturePallor = async () => {
    setError("");
    setBusy("Reading the colour");

    try {
      const canvas = grab(480);

      if (!canvas) {
        throw new Error("Start the camera first.");
      }

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      const toBox = (guide) => [
        Math.round(guide.x * canvas.width),
        Math.round(guide.y * canvas.height),
        Math.round(guide.w * canvas.width),
        Math.round(guide.h * canvas.height),
      ];

      const body = new FormData();

      body.append("file", blob, "eyelid.png");
      body.append("conjunctivaBox", JSON.stringify(toBox(CONJUNCTIVA_GUIDE)));
      body.append("scleraBox", JSON.stringify(toBox(SCLERA_GUIDE)));

      const result = await readResult(
        await post("/api/triage/pallor", { body }),
        "Could not read the photo."
      );

      if (!result.ok) {
        throw new Error(result.reason || "Could not read the photo.");
      }

      setPallor(result);
      stopCamera();
      setStep(3);
    } catch (captureError) {
      setError(captureError.message || "Could not read the photo.");
    } finally {
      setBusy("");
    }
  };

  // ---------------------------------------------------------
  // STEP 4 - QUESTIONS AND SCORE
  // ---------------------------------------------------------

  const submit = async () => {
    setError("");
    setBusy("Scoring");

    try {
      const questionnaire = {
        age: form.age ? Number(form.age) : null,
        yearsWithDiabetes: form.yearsWithDiabetes
          ? Number(form.yearsWithDiabetes)
          : null,
        hba1c: form.hba1c ? Number(form.hba1c) : null,
        systolicBp: form.systolicBp ? Number(form.systolicBp) : null,
        smoker: form.smoker,
        visionSymptoms: form.visionSymptoms,
      };

      const result = await readResult(
        await post("/api/triage", {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: patient.id,
            ppg,
            plr,
            pallor,
            questionnaire,
          }),
        }),
        "Could not record the assessment."
      );

      navigate(`/patient/triage/${result.id}`);
    } catch (submitError) {
      setError(submitError.message || "Could not record the assessment.");
    } finally {
      setBusy("");
    }
  };

  const change = (field) => (event) =>
    setForm({
      ...form,
      [field]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });

  // ---------------------------------------------------------
  // RESULT
  // ---------------------------------------------------------

  // ---------------------------------------------------------
  // STEPS
  // ---------------------------------------------------------

  const active = STEPS[step];

  return (
    <div className="container">

      {screenFlash && <div className="screen-flash" />}

      <BackLink to="/patient/dashboard" label="Dashboard" />

      <h1>Camera screening</h1>

      <p className="subtitle">
        Four quick measurements, no extra equipment
      </p>

      <ol className="triage-steps">
        {STEPS.map((item, index) => (
          <li
            key={item.key}
            className={
              index === step
                ? "is-active"
                : index < step
                  ? "is-done"
                  : ""
            }
          >
            {index <= step ? (
              <button
                type="button"
                className="triage-step-button"
                onClick={() => {
                  stopCamera();
                  setStep(index);
                }}
              >
                {item.title}
              </button>
            ) : (
              item.title
            )}
          </li>
        ))}
      </ol>

      <div className="upload-area">

        {active.key !== "questions" && (
          <div className="capture-frame">
            <video ref={videoRef} playsInline muted />

            {active.key === "pallor" && (
              <>
                <span
                  className="guide guide-conjunctiva"
                  style={{
                    left: `${CONJUNCTIVA_GUIDE.x * 100}%`,
                    top: `${CONJUNCTIVA_GUIDE.y * 100}%`,
                    width: `${CONJUNCTIVA_GUIDE.w * 100}%`,
                    height: `${CONJUNCTIVA_GUIDE.h * 100}%`,
                  }}
                />
                <span
                  className="guide guide-sclera"
                  style={{
                    left: `${SCLERA_GUIDE.x * 100}%`,
                    top: `${SCLERA_GUIDE.y * 100}%`,
                    width: `${SCLERA_GUIDE.w * 100}%`,
                    height: `${SCLERA_GUIDE.h * 100}%`,
                  }}
                />
              </>
            )}
          </div>
        )}

        {busy && (
          <div className="triage-progress">
            <p>{busy}...</p>

            {progress > 0 && (
              <span className="triage-bar">
                <span style={{ width: `${progress}%` }} />
              </span>
            )}

            {level > 0 && (
              <p className="triage-level">
                signal level {level} / 255{" "}
                {level < 40
                  ? "- too dark, cover the lens and the flash"
                  : "- good, hold still"}
              </p>
            )}
          </div>
        )}

        {/* ---------------- pulse ---------------- */}

        {active.key === "ppg" && !busy && (
          <>
            <p className="capture-note">
              Cover the rear camera <strong>and the flash</strong> completely
              with your fingertip. Rest your hand on a table and stay still for{" "}
              {PPG_SECONDS} seconds.
            </p>

            <button onClick={recordPulse}>Start pulse recording</button>
          </>
        )}

        {/* ---------------- pupil ---------------- */}

        {active.key === "plr" && !busy && (
          <>
            <p className="capture-note">
              In a dim room, hold the camera about 20 cm from one eye so the
              eye fills the frame. Keep it open and look at the lens - the
              light will flash briefly.
            </p>

            {torchOn && (
              <p className="capture-note">Torch on</p>
            )}

            <button onClick={recordPupil}>Start pupil test</button>
          </>
        )}

        {/* ---------------- eyelid ---------------- */}

        {active.key === "pallor" && !busy && (
          <>
            <p className="capture-note">
              Gently pull the lower eyelid down. Line the inner lid up with the
              lower box and the white of the eye with the upper box.
            </p>

            <div className="capture-actions">
              <button onClick={() => startCamera("environment")}>
                Start camera
              </button>

              <button onClick={capturePallor}>Capture</button>

              <button
                className="back-button"
                onClick={() => {
                  stopCamera();
                  setStep(3);
                }}
              >
                Skip this step
              </button>
            </div>
          </>
        )}

        {/* ---------------- questions ---------------- */}

        {active.key === "questions" && (
          <form
            className="patient-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >

            <label className="field">
              Age
              <input
                type="number"
                min="1"
                max="120"
                value={form.age}
                onChange={change("age")}
              />
            </label>

            <label className="field">
              Years since your diabetes diagnosis
              <input
                type="number"
                min="0"
                max="80"
                value={form.yearsWithDiabetes}
                onChange={change("yearsWithDiabetes")}
              />
            </label>

            <label className="field">
              Last HbA1c, % (leave blank if unknown)
              <input
                type="number"
                step="0.1"
                min="4"
                max="20"
                value={form.hba1c}
                onChange={change("hba1c")}
              />
            </label>

            <label className="field">
              Systolic blood pressure, mmHg (leave blank if unknown)
              <input
                type="number"
                min="70"
                max="260"
                value={form.systolicBp}
                onChange={change("systolicBp")}
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.smoker}
                onChange={change("smoker")}
              />
              I smoke
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.visionSymptoms}
                onChange={change("visionSymptoms")}
              />
              My vision has become blurred or changed recently
            </label>

            <button type="submit" disabled={Boolean(busy)}>
              {busy ? "Scoring..." : "Get my screening priority"}
            </button>

          </form>
        )}

        {error && <p className="error">{error}</p>}

      </div>

      {/* ---------------- what has been measured ---------------- */}

      <div className="triage-measured">

        <p>
          <strong>Pulse:</strong>{" "}
          {ppg
            ? `${ppg.heartRateBpm} bpm, HRV ${ppg.rmssdMs} ms` +
              (ppg.hrvReliable ? "" : " (variability not reliable)")
            : "not measured"}
        </p>

        <p>
          <strong>Pupil:</strong>{" "}
          {plr
            ? `${plr.baselineMm} mm resting, constricted ${plr.constrictionPercent}%`
            : "not measured"}
        </p>

        <p>
          <strong>Eyelid:</strong>{" "}
          {pallor
            ? `pallor index ${pallor.pallorIndex}`
            : "not measured"}
        </p>

      </div>

      {step < 3 && (
        <button
          className="back-button"
          onClick={() => {
            stopCamera();
            setStep(step + 1);
          }}
        >
          Skip to the next step
        </button>
      )}

    </div>
  );
}

export default TriagePage;
