import { useCallback, useEffect, useRef, useState } from "react";

import { API_URL, apiError, authHeaders } from "../config";

/**
 * Runs the model continuously on frames from a <video> element.
 *
 * One request is in flight at a time: the next frame is grabbed only when the
 * previous result is back, so a slow network or a busy CPU lowers the frame
 * rate instead of building a queue of stale frames.
 *
 * Single-frame predictions jitter, so the reading shown to the user is the
 * mean of the last SMOOTH_WINDOW results.
 */

const FRAME_SIZE = 224;      // what the model consumes anyway
const JPEG_QUALITY = 0.7;    // enough for 224px, keeps the upload small
const MIN_GAP_MS = 40;       // small gap so the UI can paint between frames
const SMOOTH_WINDOW = 5;

const CLASS_ORDER = [
  "No DR",
  "Mild",
  "Moderate",
  "Severe",
  "Proliferative",
];

function averageProbabilities(samples) {
  const total = {};

  CLASS_ORDER.forEach((name) => {
    total[name] = 0;
  });

  samples.forEach((sample) => {
    CLASS_ORDER.forEach((name) => {
      total[name] += (sample.probabilities || {})[name] || 0;
    });
  });

  const averaged = {};

  CLASS_ORDER.forEach((name) => {
    averaged[name] = total[name] / samples.length;
  });

  let topName = CLASS_ORDER[0];

  CLASS_ORDER.forEach((name) => {
    if (averaged[name] > averaged[topName]) {
      topName = name;
    }
  });

  return {
    prediction: topName,
    classId: CLASS_ORDER.indexOf(topName),
    confidence: averaged[topName],
    probabilities: averaged,
  };
}

export function useLiveAnalysis(videoRef, { withHeatmap = false } = {}) {
  const [running, setRunning] = useState(false);
  const [reading, setReading] = useState(null);
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [frames, setFrames] = useState(0);
  const [error, setError] = useState("");

  const runningRef = useRef(false);
  const canvasRef = useRef(null);
  const samplesRef = useRef([]);
  const heatmapRef = useRef("");

  const grabFrame = useCallback(() => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      return null;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;

    canvas.width = FRAME_SIZE;
    canvas.height = FRAME_SIZE;

    // Centre crop, so the aspect ratio is not squashed before the model sees it.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;

    canvas
      .getContext("2d")
      .drawImage(video, sx, sy, side, side, 0, 0, FRAME_SIZE, FRAME_SIZE);

    return new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
  }, [videoRef]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    samplesRef.current = [];

    setRunning(true);
    setError("");
    setFrames(0);

    const loop = async () => {
      while (runningRef.current) {
        const startedAt = performance.now();

        try {
          const blob = await grabFrame();

          if (!blob) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }

          const form = new FormData();

          form.append("file", blob, "frame.jpg");
          form.append("heatmap", withHeatmap ? "true" : "false");

          const response = await fetch(
            `${API_URL}/api/screenings/live`,
            {
              method: "POST",
              headers: authHeaders(),
              body: form,
            }
          );

          const text = await response.text();

          if (!response.ok) {
            throw new Error(
              apiError(text, "Live analysis failed.")
            );
          }

          const result = JSON.parse(text);

          if (!runningRef.current) {
            break;
          }

          if (result.heatmapInline) {
            heatmapRef.current = result.heatmapInline;
          }

          const samples = [...samplesRef.current, result].slice(
            -SMOOTH_WINDOW
          );

          samplesRef.current = samples;

          const smoothed = averageProbabilities(samples);

          const elapsed = performance.now() - startedAt;

          setReading({
            ...smoothed,
            latest: result,
            modelTrained: result.modelTrained,
            heatmapInline: heatmapRef.current,
            samples: samples.length,
          });

          setLatencyMs(Math.round(elapsed));
          setFps(Math.round((1000 / Math.max(elapsed, 1)) * 10) / 10);
          setFrames((count) => count + 1);
          setError("");

          const remaining = MIN_GAP_MS - (performance.now() - startedAt);

          if (remaining > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, remaining)
            );
          }
        } catch (loopError) {
          if (!runningRef.current) {
            break;
          }

          console.error("Live analysis error:", loopError);

          setError(loopError.message || "Live analysis failed.");

          // Back off before trying again, so a broken link does not spin.
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    };

    loop();
  }, [grabFrame, withHeatmap]);

  // Never leave the loop running after the page goes away.
  useEffect(() => {
    return () => {
      runningRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    samplesRef.current = [];
    heatmapRef.current = "";
    setReading(null);
    setFrames(0);
  }, []);

  return {
    running,
    reading,
    fps,
    latencyMs,
    frames,
    error,
    start,
    stop,
    reset,
  };
}

export default useLiveAnalysis;
