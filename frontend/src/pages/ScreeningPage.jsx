import { useState } from "react";

function ScreeningPage({
  patient,
  onBack,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);

    const imageUrl =
      URL.createObjectURL(selectedFile);

    setPreview(imageUrl);
  };

  const analyzeImage = async () => {
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token =
        localStorage.getItem("authToken");

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const formData = new FormData();

      formData.append(
        "patientId",
        patient.id
      );

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        "http://localhost:8080/api/screenings/analyze",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const responseText =
        await response.text();

      if (!response.ok) {
        throw new Error(
          responseText ||
          "Could not analyze the image."
        );
      }

      const screening =
        JSON.parse(responseText);

      setResult(screening);

    } catch (error) {
      console.error(
        "Screening error:",
        error
      );

      setError(
        error.message ||
        "Could not analyze the image."
      );
    } finally {
      setLoading(false);
    }
  };

  const getFileName = (path) => {
    if (!path) {
      return "";
    }

    return path.split("\\").pop();
  };

  const getGeneratedImageUrl = (path) => {
    if (!path) {
      return "";
    }

    return (
      "http://localhost:8000/generated/" +
      getFileName(path)
    );
  };

  return (
    <div className="container">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      <h1>
        Diabetic Retinopathy Screening
      </h1>

      <p className="subtitle">
        Upload a retinal fundus image for AI-assisted screening
      </p>

      <div className="upload-area">

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />

        {preview && (
          <div>
            <h2>Image Preview</h2>

            <img
              src={preview}
              alt="Selected retinal image"
              className="preview-image"
            />
          </div>
        )}

        <button
          onClick={analyzeImage}
          disabled={loading || !file}
        >
          {loading
            ? "Analyzing..."
            : "Analyze Image"}
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </div>

      {result && (
        <div className="screening-result">

          <h2>Screening Result</h2>

          <div className="result-card">

            <h3>
              {result.prediction}
            </h3>

            <p>
              Confidence:{" "}
              {(
                result.confidence * 100
              ).toFixed(2)}
              %
            </p>

            <p>
              Status: {result.status}
            </p>

          </div>

          <div className="images">

            <div>
              <h3>Original Image</h3>

              <img
                src={getGeneratedImageUrl(
                  result.originalImagePath
                )}
                alt="Original retinal image"
              />
            </div>

            <div>
              <h3>AI Heatmap</h3>

              <img
                src={getGeneratedImageUrl(
                  result.heatmapPath
                )}
                alt="AI heatmap"
              />
            </div>

            <div>
              <h3>Heatmap Overlay</h3>

              <img
                src={getGeneratedImageUrl(
                  result.overlayPath
                )}
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