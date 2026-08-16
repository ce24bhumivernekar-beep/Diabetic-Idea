function ScreeningResult({ screening, onBack }) {
  const getFileName = (path) => {
    if (!path) {
      return "";
    }

    return path.split("\\").pop();
  };

  const originalImage =
    `http://localhost:8000/generated/${getFileName(
      screening.originalImagePath
    )}`;

  const heatmapImage =
    `http://localhost:8000/generated/${getFileName(
      screening.heatmapPath
    )}`;

  const overlayImage =
    `http://localhost:8000/generated/${getFileName(
      screening.overlayPath
    )}`;

  return (
    <div className="container">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      <h1>Screening Result</h1>

      <div className="result-card">

        <h2>{screening.prediction}</h2>

        <p>
          Model confidence:{" "}
          {(screening.confidence * 100).toFixed(2)}%
        </p>

        <p>
          Status: {screening.status}
        </p>

        <p>
          Date:{" "}
          {new Date(
            screening.createdAt
          ).toLocaleString()}
        </p>

      </div>

      <div className="images">

        <div>
          <h3>Original Image</h3>

          <img
            src={originalImage}
            alt="Original retinal image"
          />
        </div>

        <div>
          <h3>AI Heatmap</h3>

          <img
            src={heatmapImage}
            alt="AI heatmap"
          />
        </div>

        <div>
          <h3>Heatmap Overlay</h3>

          <img
            src={overlayImage}
            alt="Heatmap overlay"
          />
        </div>

      </div>

    </div>
  );
}

export default ScreeningResult;