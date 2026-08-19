import { useCallback, useEffect, useRef, useState } from "react";

import useLiveAnalysis from "../hooks/useLiveAnalysis";
import LiveReadout from "./LiveReadout";

/**
 * Camera capture for the screening page.
 *
 * One path: a getUserMedia preview with a shutter button, and a live reading
 * while it runs. Browsers only allow this in a secure context, which the
 * deployed site is; over plain http the component says so rather than
 * pretending the camera is available. An existing photo can still be uploaded
 * from the screening page itself.
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
          "Camera permission was denied. Allow it from the icon in the browser address bar, then start the camera again."
        );
      } else if (name === "NotFoundError") {
        setError(
          "No camera found on this device. You can upload an existing photo instead."
        );
      } else {
        setError(
          "Could not start the camera. You can upload an existing photo instead."
        );
      }

      setStreaming(false);
    } finally {
      setBusy(false);
    }
  }, [facing, stopCamera, live]);

  // Flipping between the front and rear camera is a user action, so it is
  // handled here rather than in an effect reacting to state.
  const switchCamera = async () => {
    const next =
      facing === "environment" ? "user" : "environment";

    setFacing(next);

    if (streaming) {
      await startCamera(next);
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

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="capture">

      <div className="capture-live">

          {!liveSupported ? (
            <p className="capture-note">
              This browser will not open the camera because the page is not on
              HTTPS. Open the site over https, or upload an existing photo
              below.
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

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {streaming && (
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
