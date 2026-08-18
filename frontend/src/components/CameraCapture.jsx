import { useCallback, useEffect, useRef, useState } from "react";

import useLiveAnalysis from "../hooks/useLiveAnalysis";
import LiveReadout from "./LiveReadout";

/**
 * Camera capture for the screening page.
 *
 * Two paths, because the browser forces the choice:
 *
 *   live   - getUserMedia preview with a shutter button. Only allowed in a
 *            secure context, so localhost or HTTPS. On a phone served over
 *            plain http://192.168.x.x the browser blocks it outright.
 *   native - <input capture="environment"> hands off to the phone camera app
 *            and returns the photo. Works over plain HTTP, so this is the
 *            path that carries a real phone on the local network.
 *
 * The component picks the live path when the browser allows it and falls back
 * to native otherwise; the user can also switch by hand.
 */

function canUseLiveCamera() {
  return Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
  );
}

function CameraCapture({ onCapture, disabled }) {
  const liveSupported = canUseLiveCamera();

  const [mode, setMode] = useState(
    liveSupported ? "live" : "native"
  );

  const [streaming, setStreaming] = useState(false);
  const [facing, setFacing] = useState("environment");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Continuous inference on the frames coming out of the preview.
  const live = useLiveAnalysis(videoRef);

  // stopCamera is created before `live` exists, so it reaches the stopper
  // through a ref instead of a stale closure.
  const stopLiveRef = useRef(() => {});

  useEffect(() => {
    stopLiveRef.current = live.stop;
  }, [live.stop]);

  // ---------------------------------------------------------
  // CAMERA LIFECYCLE
  // ---------------------------------------------------------

  const stopCamera = useCallback(() => {
    stopLiveRef.current();

    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStreaming(false);
  }, []);

  const startCamera = useCallback(async (requestedFacing) => {
    const wanted = requestedFacing || facing;

    setError("");
    setBusy(true);

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: wanted },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStreaming(true);

      // Real-time is the point: begin analysing immediately.
      live.reset();
      live.start();
    } catch (cameraError) {
      console.error("Camera error:", cameraError);

      const name = cameraError && cameraError.name;

      if (name === "NotAllowedError") {
        setError(
          "Camera permission was denied. Allow it in the browser address bar, or use the phone camera option."
        );
      } else if (name === "NotFoundError") {
        setError(
          "No camera found on this device. Use the phone camera or file upload option."
        );
      } else {
        setError(
          "Could not start the camera. Use the phone camera or file upload option."
        );
      }

      setStreaming(false);
    } finally {
      setBusy(false);
    }
  }, [facing, stopCamera, live]);

  // Switching cameras and switching modes are user actions, so they are
  // handled here rather than in an effect that reacts to state.
  const switchCamera = async () => {
    const next =
      facing === "environment" ? "user" : "environment";

    setFacing(next);

    if (streaming) {
      await startCamera(next);
    }
  };

  const selectMode = (next) => {
    setMode(next);

    if (next !== "live") {
      stopCamera();
    }
  };

  // Never leave the camera light on after the page goes away.
  useEffect(() => stopCamera, [stopCamera]);

  // ---------------------------------------------------------
  // CAPTURE
  // ---------------------------------------------------------

  const captureFrame = async () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      setError("The camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas
      .getContext("2d")
      .drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setError("Could not read the frame from the camera.");
      return;
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const file = new File(
      [blob],
      `capture-${stamp}.jpg`,
      { type: "image/jpeg" }
    );

    onCapture(file);

    stopCamera();
  };

  const handleNativeFile = (event) => {
    const file = event.target.files && event.target.files[0];

    if (file) {
      onCapture(file);
    }
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="capture">

      <div className="capture-modes">

        <button
          type="button"
          className={
            mode === "live"
              ? "capture-tab is-active"
              : "capture-tab"
          }
          onClick={() => selectMode("live")}
          disabled={disabled}
        >
          Live camera
        </button>

        <button
          type="button"
          className={
            mode === "native"
              ? "capture-tab is-active"
              : "capture-tab"
          }
          onClick={() => selectMode("native")}
          disabled={disabled}
        >
          Phone camera
        </button>

      </div>

      {mode === "live" && (
        <div className="capture-live">

          {!liveSupported ? (
            <p className="capture-note">
              This browser will not open the camera in the page because the
              site is not on HTTPS. Use <strong>Phone camera</strong>, which
              works over a plain local network address.
            </p>
          ) : (
            <>
              <div
                className={
                  streaming
                    ? "capture-frame is-live"
                    : "capture-frame"
                }
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={streaming ? "" : "is-hidden"}
                />

                {!streaming && (
                  <span className="capture-placeholder">
                    camera off
                  </span>
                )}
              </div>

              {streaming && (
                <LiveReadout
                  reading={live.reading}
                  fps={live.fps}
                  latencyMs={live.latencyMs}
                  frames={live.frames}
                  error={live.error}
                />
              )}

              <div className="capture-actions">

                {!streaming ? (
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={disabled || busy}
                  >
                    {busy ? "Starting..." : "Start camera"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={captureFrame}
                      disabled={disabled}
                    >
                      Save this scan
                    </button>

                    <button
                      type="button"
                      className="back-button"
                      onClick={
                        live.running ? live.stop : live.start
                      }
                      disabled={disabled}
                    >
                      {live.running
                        ? "Pause analysis"
                        : "Resume analysis"}
                    </button>

                    <button
                      type="button"
                      className="back-button"
                      onClick={switchCamera}
                      disabled={disabled}
                    >
                      Switch camera
                    </button>

                    <button
                      type="button"
                      className="back-button"
                      onClick={stopCamera}
                      disabled={disabled}
                    >
                      Stop
                    </button>
                  </>
                )}

              </div>
            </>
          )}

        </div>
      )}

      {mode === "native" && (
        <div className="capture-native">

          <p className="capture-note">
            Opens the camera app on the phone and brings the photo straight
            back here.
          </p>

          <label className="capture-native-button">

            Open phone camera

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleNativeFile}
              disabled={disabled}
            />

          </label>

        </div>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {mode === "live" && streaming && (
        <p className="capture-note capture-live-note">
          The reading above updates continuously and is not stored.
          <strong> Save this scan</strong> records the current frame for a
          doctor to review.
        </p>
      )}

      <p className="capture-hint">
        A phone camera alone photographs the front of the eye. A usable retinal
        image needs a fundus lens attachment or a fundus camera feeding the
        phone.
      </p>

    </div>
  );
}

export default CameraCapture;
