import { useState } from "react";

function ScreeningPage({ patient, onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setSelectedImage(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  const analyzeImage = async () => {
    if (!selectedFile) {
      setError("Please select a retinal image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();

    // IMPORTANT:
    // Use the actual MongoDB patient ID
    // instead of our old test ID.
    formData.append("patientId", patient.id);
    formData.append("file", selectedFile);

    try {
      const response = await fetch(
        "http://localhost:8080/api/screenings/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }

      const data = await response.json();

      setResult(data);

    } catch (error) {
      console.error(error);

      setError(
        "Could not analyze the image. Please make sure the Java backend and Python AI service are running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back
      </button>

      <h1>Retinal Screening</h1>

      <p className="subtitle">
        Patient: <strong>{patient.name}</strong>
      </p>

      <p className="patient-id">
        Patient ID: {patient.id}
      </p>

      <div className="upload-box">

        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleImageChange}
        />

        {selectedImage && (
          <div className="preview">

            <h2>Image Preview</h2>

            <img
              src={selectedImage}
              alt="Retinal preview"
            />

          </div>
        )}

        <button
          onClick={analyzeImage}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze Image"}
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </div>

      {result && (
        <div className="result">

          <h2>Screening Result</h2>

          <div className="result-card">

            <h3>{result.prediction}</h3>

            <p>
              Confidence:{" "}
              {(result.confidence * 100).toFixed(2)}%
            </p>

            <p>
              Status: {result.status}
            </p>

          </div>

          <div className="images">

            <div>
              <h3>Original Image</h3>

              <img
                src={`http://localhost:8000/generated/${result.originalImagePath.split("\\").pop()}`}
                alt="Original retinal image"
              />
            </div>

            <div>
              <h3>AI Heatmap</h3>

              <img
                src={`http://localhost:8000/generated/${result.heatmapPath.split("\\").pop()}`}
                alt="AI heatmap"
              />
            </div>

            <div>
              <h3>Heatmap Overlay</h3>

              <img
                src={`http://localhost:8000/generated/${result.overlayPath.split("\\").pop()}`}
                alt="Heatmap overlay"
              />
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

export default ScreeningPage;