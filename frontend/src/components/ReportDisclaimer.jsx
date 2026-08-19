/**
 * The block that must survive being printed, photocopied and faxed.
 *
 * Deliberately not softened: the model misses roughly a third of referable
 * disease, and a report that travels away from the app has to say so on its
 * own.
 */
function ReportDisclaimer({ metrics, reviewed }) {
  const sensitivity =
    metrics && typeof metrics.referableSensitivity === "number"
      ? `${(metrics.referableSensitivity * 100).toFixed(0)}%`
      : null;

  const specificity =
    metrics && typeof metrics.referableSpecificity === "number"
      ? `${(metrics.referableSpecificity * 100).toFixed(0)}%`
      : null;

  return (
    <section className="report-disclaimer">

      <h3>Important</h3>

      <p>
        This is an <strong>AI-assisted screening aid, not a diagnosis</strong>.
        It does not replace examination by a qualified ophthalmologist.
      </p>

      {sensitivity && specificity && (
        <p>
          On {metrics.testImages?.toLocaleString?.() || "held-out"} unseen
          images this model detected {sensitivity} of referable disease at{" "}
          {specificity} specificity — meaning a negative result does not rule
          out retinopathy, and roughly one in three referable cases is missed.
        </p>
      )}

      {!reviewed && (
        <p className="report-unreviewed">
          This report has NOT been reviewed by a clinician.
        </p>
      )}

    </section>
  );
}

export default ReportDisclaimer;
