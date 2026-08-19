import { screeningImageUrl } from "../config";

/**
 * The full read-out of one screening: grade, what it means, the probability
 * spread across all five grades, the Grad-CAM images and the doctor sign-off.
 *
 * Shared by the patient result pages and the doctor review page so all three
 * always show the same information.
 */

// International Clinical Diabetic Retinopathy scale, as reference text.
const GRADES = [
  {
    id: 0,
    name: "No DR",
    label: "No diabetic retinopathy",
    meaning:
      "No microaneurysms, haemorrhages or other retinopathy signs detected.",
    action: "Routine annual screening.",
    tone: "grade-0",
  },
  {
    id: 1,
    name: "Mild",
    label: "Mild non-proliferative",
    meaning: "Microaneurysms only.",
    action: "Re-screen in 6 to 12 months. Review blood sugar control.",
    tone: "grade-1",
  },
  {
    id: 2,
    name: "Moderate",
    label: "Moderate non-proliferative",
    meaning:
      "More than microaneurysms, but less than severe non-proliferative disease.",
    action: "Ophthalmologist review, typically within 3 to 6 months.",
    tone: "grade-2",
  },
  {
    id: 3,
    name: "Severe",
    label: "Severe non-proliferative",
    meaning:
      "Extensive haemorrhages, venous beading or intraretinal microvascular abnormalities.",
    action: "Prompt ophthalmologist referral - weeks, not months.",
    tone: "grade-3",
  },
  {
    id: 4,
    name: "Proliferative",
    label: "Proliferative diabetic retinopathy",
    meaning:
      "New vessel growth, with risk of vitreous haemorrhage and retinal detachment.",
    action: "Urgent ophthalmologist referral. Sight-threatening if untreated.",
    tone: "grade-4",
  },
];

const IMAGE_PANELS = [
  {
    kind: "original",
    title: "Uploaded image",
    caption: "The fundus photograph as received.",
  },
  {
    kind: "heatmap",
    title: "Grad-CAM heatmap",
    caption: "Red marks the regions that most influenced the grade.",
  },
  {
    kind: "overlay",
    title: "Heatmap overlay",
    caption: "The heatmap blended over the retina.",
  },
];

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function ScreeningReport({ screening }) {
  if (!screening) {
    return null;
  }

  const grade =
    GRADES.find((item) => item.id === screening.classId) || null;

  const probabilities = screening.probabilities || {};

  // Keep the clinical order of the scale, not the order of the JSON keys.
  const rows = GRADES.map((item) => ({
    ...item,
    probability: probabilities[item.name],
  })).filter((item) => typeof item.probability === "number");

  const reviewed = screening.status === "REVIEWED";

  const metrics = screening.modelMetrics || null;

  const quality = screening.quality || null;

  return (
    <div className="report">

      {quality && quality.gradable === false && (
        <p className="report-warning is-critical">
          <strong>Image quality: not gradable.</strong>{" "}
          {(quality.reasons || []).join(" ")} A grade from an image this
          quality cannot be relied on - repeat the photograph before acting on
          anything below.
        </p>
      )}

      {quality && quality.gradable && (
        <p className="report-quality">
          Image quality {quality.quality}/100 - gradable.
        </p>
      )}

      {screening.modelTrained === false && (
        <p className="report-warning">
          <strong>Demo model.</strong> This prediction comes from a
          placeholder network whose classifier is untrained, so the grade
          below is not meaningful. The image handling, heatmap and review
          workflow are real.
        </p>
      )}

      {screening.modelTrained !== false && metrics && (
        <p className="report-warning is-info">
          <strong>Research model.</strong> Measured on{" "}
          {metrics.testImages
            ? metrics.testImages.toLocaleString()
            : "held-out"}{" "}
          unseen images: agreement with graders (kappa){" "}
          {formatNumber(metrics.quadraticWeightedKappa)}, and it catches{" "}
          {formatPercent(metrics.referableSensitivity)} of referable disease
          at {formatPercent(metrics.referableSpecificity)} specificity. Useful
          for prioritising, not accurate enough to decide care on its own.
        </p>
      )}

      {/* ===================================================
          HEADLINE GRADE
         =================================================== */}

      <div
        className={
          "report-headline " + (grade ? grade.tone : "")
        }
      >

        <div className="report-headline-main">

          <span className="report-eyebrow">
            AI suggested grade
          </span>

          <h2>
            {screening.prediction || "Unknown"}
          </h2>

          {grade && (
            <p className="report-grade-label">
              Grade {grade.id} - {grade.label}
            </p>
          )}

          <p className="report-eye">
            {screening.eye === "LEFT"
              ? "Left eye (OS)"
              : screening.eye === "RIGHT"
                ? "Right eye (OD)"
                : "Eye not recorded"}
          </p>

        </div>

        <div className="report-confidence">

          <span className="report-confidence-value">
            {formatPercent(screening.confidence)}
          </span>

          <span className="report-eyebrow">
            confidence
          </span>

        </div>

      </div>

      {grade && (
        <div className="report-meaning">

          <p>
            <strong>What this grade means.</strong> {grade.meaning}
          </p>

          <p>
            <strong>Usual next step.</strong> {grade.action}
          </p>

          <p className="report-disclaimer">
            Reference information from the International Clinical Diabetic
            Retinopathy scale. It is not a diagnosis - the reviewing doctor
            decides.
          </p>

          <p className="report-disclaimer">
            <strong>Not assessed:</strong> this model grades retinopathy
            severity only. It does not look for diabetic macular oedema, which
            is a separate cause of sight loss and needs its own examination.
          </p>

        </div>
      )}

      {/* ===================================================
          PROBABILITY SPREAD
         =================================================== */}

      {rows.length > 0 && (
        <div className="report-section">

          <h3>How the model split its confidence</h3>

          <ul className="prob-list">

            {rows.map((row) => (
              <li
                key={row.id}
                className={
                  row.id === screening.classId
                    ? "prob-row is-top"
                    : "prob-row"
                }
              >

                <span className="prob-name">
                  {row.id} · {row.name}
                </span>

                <span className="prob-track">
                  <span
                    className={"prob-fill " + row.tone}
                    style={{
                      width: `${Math.max(
                        1,
                        Math.round(row.probability * 100)
                      )}%`,
                    }}
                  />
                </span>

                <span className="prob-value">
                  {formatPercent(row.probability)}
                </span>

              </li>
            ))}

          </ul>

        </div>
      )}

      {/* ===================================================
          IMAGES
         =================================================== */}

      <div className="report-section">

        <h3>Explainability</h3>

        <div className="images">

          {IMAGE_PANELS.map((panel) => {
            const source = screeningImageUrl(screening.id, panel.kind);

            return (
              <figure
                className="image-panel"
                key={panel.kind}
              >

                <h4>{panel.title}</h4>

                <div className="image-frame">
                  {source ? (
                    <img
                      src={source}
                      alt={panel.title}
                    />
                  ) : (
                    <span className="image-missing">
                      not available
                    </span>
                  )}
                </div>

                <figcaption>{panel.caption}</figcaption>

              </figure>
            );
          })}

        </div>

      </div>

      {/* ===================================================
          DOCTOR SIGN-OFF
         =================================================== */}

      <div className="report-section">

        <h3>Doctor review</h3>

        {reviewed ? (
          <div className="review-box is-reviewed">

            <p>
              <strong>Decision:</strong>{" "}
              {screening.doctorDecision || "-"}
            </p>

            <p>
              <strong>Remarks:</strong>{" "}
              {screening.doctorRemarks || "-"}
            </p>

            <p className="review-meta">
              Reviewed by {screening.reviewedBy || "a doctor"}
              {screening.reviewedAt
                ? ` on ${new Date(
                    screening.reviewedAt
                  ).toLocaleString()}`
                : ""}
            </p>

          </div>
        ) : (
          <div className="review-box is-pending">

            <p>
              Awaiting doctor review. A doctor sees this screening on their
              dashboard and signs off the final decision.
            </p>

          </div>
        )}

      </div>

      {screening.createdAt && (
        <p className="report-timestamp">
          Screened on{" "}
          {new Date(screening.createdAt).toLocaleString()}
          {screening.id ? ` · ref ${screening.id}` : ""}
        </p>
      )}

    </div>
  );
}

export default ScreeningReport;
