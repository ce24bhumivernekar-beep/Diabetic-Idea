import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import BackLink from "../components/BackLink";
import LoadingState from "../components/LoadingState";
import CameraCapture from "../components/CameraCapture";
import { API_URL, apiError } from "../config";
import { useAuth } from "../context/auth";

function ScreeningPage() {
  const { patient } = useAuth();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [waking, setWaking] = useState(false);
  const [service, setService] = useState(null);
  const [error, setError] = useState("");

  // Accepts an image from the file picker, the live camera or the phone
  // camera - all three end up here.
  const acceptImage = (selectedFile) => {
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setError("");
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleFileChange = (event) => {
    acceptImage(event.target.files[0]);
  };

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        const health = await response.json();

        if (!cancelled) {
          setService(health);
        }
      } catch {
        // A failed health check is not worth blocking the page for.
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const slowTimer = setTimeout(() => setWaking(true), 20000);

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

      navigate(`/patient/screenings/${screening.id}`, { replace: true });

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
      clearTimeout(slowTimer);
      setLoading(false);
      setWaking(false);
    }
  };

  return (
    <div className="container">

<BackLink to="/patient/dashboard" label="Dashboard" />

      <h1>
        Diabetic Retinopathy Screening
      </h1>

      <p className="subtitle">
        Upload a retinal fundus image for AI-assisted screening
      </p>

      {service && service.aiService !== "UP" && (
        <p className="report-warning">
          <strong>The analysis service is still waking up.</strong> Free
          hosting sleeps after a while. You can set up your capture now - if
          the first analysis fails, wait a few seconds and try again.
        </p>
      )}

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
            : "Analyse this image"}
        </button>

        {loading && (
          <LoadingState label="Analysing your image" waking={waking} />
        )}

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </div>



    </div>
  );
}

export default ScreeningPage;