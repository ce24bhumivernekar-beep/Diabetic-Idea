import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink";
import ScreeningReport from "../components/ScreeningReport";
import { API_URL, apiError } from "../config";
import useScreening from "../hooks/useScreening";

function DoctorReview() {
  const { id } = useParams();
  const { screening, loading: fetching, error: fetchError } = useScreening(id);

  // Only what the doctor has typed lives in state. Everything else is read
  // from the record, so nothing has to be copied across when it arrives.
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(null);

  const current = saved || screening;

  const decision = draft.decision ?? current?.doctorDecision ?? "";
  const remarks = draft.remarks ?? current?.doctorRemarks ?? "";
  const doctorName = draft.doctorName ?? current?.reviewedBy ?? "Dr. Sharma";

  const setDecision = (value) => setDraft((d) => ({ ...d, decision: value }));
  const setRemarks = (value) => setDraft((d) => ({ ...d, remarks: value }));
  const setDoctorName = (value) =>
    setDraft((d) => ({ ...d, doctorName: value }));

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

      setSaved(updatedScreening);

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

  if (fetching) {
    return (
      <div className="container doctor-review">
        <BackLink to="/doctor/dashboard" label="Review queue" />
        <p className="state-note">Loading this screening...</p>
      </div>
    );
  }

  if (fetchError || !current) {
    return (
      <div className="container doctor-review">
        <BackLink to="/doctor/dashboard" label="Review queue" />
        <p className="error">{fetchError || "Screening not found."}</p>
      </div>
    );
  }

  return (
    <div className="container doctor-review">

<BackLink to="/doctor/dashboard" label="Review queue" />

      <h1>Review screening</h1>

      <div className="review-summary">

        <h2>
          {current.patientName || "Patient"}
          {current.patientAge
            ? ` · ${current.patientAge}`
            : ""}
          {current.patientGender
            ? ` · ${current.patientGender}`
            : ""}
        </h2>

        <p>
          Patient ID:{" "}
          <strong>
            {current.patientId}
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
          <>
            <p className="success">{message}</p>

            <div className="page-actions">
              <Link className="nav-button" to="/doctor/dashboard">
                Back to the review queue
              </Link>

              <Link
                className="nav-button"
                to={`/print/screenings/${current.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Download report
              </Link>
            </div>
          </>
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