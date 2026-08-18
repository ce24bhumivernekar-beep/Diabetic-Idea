import { useEffect, useState } from "react";
import { API_URL, apiError } from "../config";
import CameraCapture from "../components/CameraCapture";
import ScreeningReport from "../components/ScreeningReport";

function ScreeningPage({
  patient,
  onBack,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Accepts an image from the file picker, the live camera or the phone
  // camera - all three end up here.
  const acceptImage = (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleFileChange = (event) => {
    acceptImage(event.target.files[0]);
  };

  // Release the object URL when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

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
        `${API_URL}/api/screenings/analyze`,
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
        throw new Error(apiError(responseText, "Could not analyze the image."));
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

        <CameraCapture
          onCapture={acceptImage}
          disabled={loading}
        />

        <div className="upload-divider">
          <span>or choose an existing image</span>
        </div>

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

            <p className="capture-filename">
              {file ? file.name : ""}
            </p>
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

          <ScreeningReport screening={result} />

        </div>
      )}

    </div>
  );
}

export default ScreeningPage;