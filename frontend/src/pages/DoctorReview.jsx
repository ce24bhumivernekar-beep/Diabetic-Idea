import { useState } from "react";

function DoctorReview({
  screening,
  onBack,
}) {
  const [decision, setDecision] = useState(
    screening.doctorDecision || ""
  );

  const [remarks, setRemarks] = useState(
    screening.doctorRemarks || ""
  );

  const [doctorName, setDoctorName] = useState(
    screening.reviewedBy || "Dr. Sharma"
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getFileName = (path) => {
    if (!path) {
      return "";
    }

    return path.split("\\").pop();
  };

  const submitReview = async () => {
    if (!decision) {
      setError("Please select a decision.");
      return;
    }

    if (!remarks.trim()) {
      setError("Please enter doctor remarks.");
      return;
    }

    if (!doctorName.trim()) {
      setError("Please enter the doctor's name.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const token =
        localStorage.getItem("authToken");

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const url =
        `http://localhost:8080/api/doctor/screening/` +
        `${screening.id}/review` +
        `?decision=${encodeURIComponent(decision)}` +
        `&remarks=${encodeURIComponent(remarks)}` +
        `&doctorName=${encodeURIComponent(doctorName)}`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText =
        await response.text();

      if (!response.ok) {
        throw new Error(
          responseText ||
          "Could not submit the doctor review."
        );
      }

      const updatedScreening =
        JSON.parse(responseText);

      setMessage(
        "Doctor review submitted successfully."
      );

      // Keep the page showing the updated review.
      setDecision(
        updatedScreening.doctorDecision || decision
      );

      setRemarks(
        updatedScreening.doctorRemarks || remarks
      );

      setDoctorName(
        updatedScreening.reviewedBy || doctorName
      );

    } catch (error) {
      console.error(
        "Doctor review error:",
        error
      );

      setError(
        error.message ||
        "Could not submit the doctor review."
      );
    } finally {
      setLoading(false);
    }
  };

  const originalImage =
    `http://localhost:8000/generated/` +
    getFileName(
      screening.originalImagePath
    );

  const heatmapImage =
    `http://localhost:8000/generated/` +
    getFileName(
      screening.heatmapPath
    );

  const overlayImage =
    `http://localhost:8000/generated/` +
    getFileName(
      screening.overlayPath
    );

  return (
    <div className="container doctor-review">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      <h1>Doctor Review</h1>

      <div className="review-summary">

        <h2>
          AI Prediction:{" "}
          {screening.prediction}
        </h2>

        <p>
          Patient ID:{" "}
          <strong>
            {screening.patientId}
          </strong>
        </p>

        <p>
          Model confidence:{" "}
          <strong>
            {(
              screening.confidence * 100
            ).toFixed(2)}
            %
          </strong>
        </p>

        <p>
          Screening status:{" "}
          <strong>
            {screening.status}
          </strong>
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

      <div className="review-form">

        <h2>Doctor Decision</h2>

        <select
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value);
            setError("");
            setMessage("");
          }}
        >
          <option value="">
            Select Decision
          </option>

          <option value="CONFIRMED">
            Confirm AI Result
          </option>

          <option value="FLAGGED">
            Flag for Further Review
          </option>

          <option value="NEEDS_FURTHER_EXAMINATION">
            Needs Further Examination
          </option>
        </select>

        <input
          type="text"
          value={doctorName}
          onChange={(event) => {
            setDoctorName(event.target.value);
            setError("");
            setMessage("");
          }}
          placeholder="Doctor Name"
        />

        <textarea
          value={remarks}
          onChange={(event) => {
            setRemarks(event.target.value);
            setError("");
            setMessage("");
          }}
          placeholder="Doctor remarks"
          rows="5"
        />

        <button
          onClick={submitReview}
          disabled={loading}
        >
          {loading
            ? "Submitting..."
            : "Submit Review"}
        </button>

        {message && (
          <p className="success">
            {message}
          </p>
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

export default DoctorReview;