import ScreeningReport from "../components/ScreeningReport";

function ScreeningResult({ screening, onBack }) {
  return (
    <div className="container">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      <h1>Screening Result</h1>

      <p className="subtitle">
        AI-assisted grading with an explainability heatmap
      </p>

      <ScreeningReport screening={screening} />

    </div>
  );
}

export default ScreeningResult;
