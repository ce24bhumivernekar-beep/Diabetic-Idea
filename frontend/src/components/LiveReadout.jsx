const GRADES = [
  { name: "No DR", tone: "grade-0" },
  { name: "Mild", tone: "grade-1" },
  { name: "Moderate", tone: "grade-2" },
  { name: "Severe", tone: "grade-3" },
  { name: "Proliferative", tone: "grade-4" },
];

/**
 * The reading shown while the camera is running. Deliberately compact: the
 * grade, how sure the model is, the spread, and how fast frames are actually
 * being processed - so nobody has to guess whether it is still running.
 */
function LiveReadout({ reading, fps, latencyMs, frames, error }) {
  if (error) {
    return (
      <div className="live-readout is-error">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!reading) {
    return (
      <div className="live-readout is-waiting">
        <p>Waiting for the first frame...</p>
      </div>
    );
  }

  const grade =
    GRADES[reading.classId] || GRADES[0];

  return (
    <div className={"live-readout " + grade.tone}>

      <div className="live-readout-head">

        <div>
          <span className="report-eyebrow">
            live reading
          </span>

          <h3>{reading.prediction}</h3>

          <p className="live-readout-sub">
            averaged over the last {reading.samples} frame
            {reading.samples === 1 ? "" : "s"}
          </p>
        </div>

        <div className="live-readout-confidence">
          <span>
            {(reading.confidence * 100).toFixed(1)}%
          </span>
          <span className="report-eyebrow">
            confidence
          </span>
        </div>

      </div>

      <ul className="prob-list live-prob-list">

        {GRADES.map((item, index) => {
          const value = reading.probabilities[item.name] || 0;

          return (
            <li
              key={item.name}
              className={
                index === reading.classId
                  ? "prob-row is-top"
                  : "prob-row"
              }
            >

              <span className="prob-name">
                {index} · {item.name}
              </span>

              <span className="prob-track">
                <span
                  className={"prob-fill " + item.tone}
                  style={{
                    width: `${Math.max(
                      1,
                      Math.round(value * 100)
                    )}%`,
                  }}
                />
              </span>

              <span className="prob-value">
                {(value * 100).toFixed(1)}%
              </span>

            </li>
          );
        })}

      </ul>

      <p className="live-stats">
        {fps} fps · {latencyMs} ms per frame · {frames} frames analysed
        {reading.modelTrained === false
          ? " · demo model, grades are placeholders"
          : ""}
      </p>

    </div>
  );
}

export default LiveReadout;
