/**
 * The framing aid drawn over the live preview.
 *
 * Without it a patient has no way to know whether the lens is aimed at the
 * retina, too close, too dark, or aimed at nothing at all - they only found
 * out after saving a scan the model then graded anyway.
 */
function CameraGuide({ quality }) {
  const detected = Boolean(quality && quality.eyeDetected);
  const gradable = Boolean(quality && quality.gradable);

  const state = !quality
    ? "waiting"
    : !detected
      ? "searching"
      : gradable
        ? "ready"
        : "adjusting";

  return (
    <>
      <span className={"camera-target is-" + state} aria-hidden="true" />

      <div className={"camera-guidance is-" + state}>
        <p>
          {quality
            ? quality.guidance
            : "Point the lens at the eye..."}
        </p>

        {detected && (
          <span className="camera-quality">
            image quality {quality.quality}/100
          </span>
        )}
      </div>
    </>
  );
}

export default CameraGuide;
