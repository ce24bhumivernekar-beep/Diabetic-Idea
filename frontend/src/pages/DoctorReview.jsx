import { useState } from "react";
import { API_URL, apiError } from "../config";
import ScreeningReport from "../components/ScreeningReport";

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

  // The saved screening. Replaced by the server copy after a review is
  // submitted, so the summary and the report below never disagree.
  const [current, setCurrent] = useState(screening);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        `${API_URL}/api/doctor/screening/` +
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
        throw new Error(apiError(responseText, "Could not submit the doctor review."));
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

      setCurrent(updatedScreening);

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

  return (
    <div className="container doctor-review">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Dashboard
      </button>

      <h1>Doctor Review</h1>

      <div className="review-summary">

        <h2>
          {screening.patientName || "Patient"}
          {screening.patientAge
            ? ` · ${screening.patientAge}`
            : ""}
          {screening.patientGender
            ? ` · ${screening.patientGender}`
            : ""}
        </h2>

        <p>
          Patient ID:{" "}
          <strong>
            {screening.patientId}
          </strong>
        </p>

        <p>
          Screening status:{" "}
          <strong>
            {current.status}
          </strong>
        </p>

      </div>

      <ScreeningReport screening={current} />

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