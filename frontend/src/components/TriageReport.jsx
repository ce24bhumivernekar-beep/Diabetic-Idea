/**
 * The read-out of one camera health check: the priority it came out at, every
 * point that built the score, and what could not be measured.
 *
 * Shared by the live result, the saved result page, the doctor's queue detail
 * and the printable version, so all four always say the same thing.
 */
function TriageReport({ assessment, showDisclaimer = true }) {
  if (!assessment) {
    return null;
  }

  const tone = String(assessment.priority || "").toLowerCase();

  return (
    <div className="triage-report">

      <div className={"triage-result priority-" + tone}>

        <span className="report-eyebrow">recommended priority</span>

        <h2>{assessment.priority}</h2>

        <p className="triage-within">
          Retinal exam within <strong>{assessment.recommendedWithin}</strong>
        </p>

        <p className="triage-score">
          Risk score {assessment.score} / 100
        </p>

      </div>

      <div className="report-section">

        <h3>What went into it</h3>

        <ul className="triage-reasons">
          {(assessment.reasons || []).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        {(assessment.measurementsSkipped || []).length > 0 && (
          <>
            <h3>Not counted</h3>

            <ul className="triage-reasons is-muted">
              {assessment.measurementsSkipped.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}

      </div>

      {assessment.createdAt && (
        <p className="report-timestamp">
          Checked on {new Date(assessment.createdAt).toLocaleString()}
          {assessment.id ? ` · ref ${assessment.id}` : ""}
        </p>
      )}

      {showDisclaimer && (
        <p className="capture-hint">
          This is a queue position, not a diagnosis. It says how soon someone
          should look at your retina - it cannot tell whether you have
          retinopathy, because a phone camera alone cannot see the retina.
        </p>
      )}

    </div>
  );
}

export default TriageReport;
