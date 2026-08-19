import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BackLink from "../components/BackLink";
import { API_URL, apiError } from "../config";
import { useAuth } from "../context/auth";
import useLiveEvents from "../hooks/useLiveEvents";

function PatientDashboard() {
  const { patient } = useAuth();

  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const token =
          localStorage.getItem("authToken");

        if (!token) {
          throw new Error(
            "Authentication token not found. Please login again."
          );
        }

        const response = await fetch(
          `${API_URL}/api/screenings/patient/${patient.id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const responseText =
          await response.text();

        if (!response.ok) {
          throw new Error(apiError(responseText, "Could not load screening history."));
        }

        const data =
          JSON.parse(responseText);

        if (!cancelled) {
          setScreenings(data);
          setError("");
        }

      } catch (loadError) {
        console.error(
          "Patient dashboard error:",
          loadError
        );

        if (!cancelled) {
          setError(
            loadError.message ||
            "Could not load screening history."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [patient.id, reloadToken]);

  // The doctor signing off arrives here without a refresh.
  const { live } = useLiveEvents(
    ["screening-reviewed"],
    (name, payload) => {
      reload();

      if (name === "screening-reviewed") {
        setFlash(
          `A doctor reviewed your screening${
            payload && payload.decision
              ? `: ${payload.decision}`
              : ""
          }`
        );
      }
    }
  );

  useEffect(() => {
    if (!flash) {
      return undefined;
    }

    const timer = setTimeout(() => setFlash(""), 8000);

    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <div className="container dashboard">

      <BackLink to="/" label="Home" />

      <h1>Patient Dashboard</h1>

      <div className="patient-info">

        <h2>Hello, {patient.name}</h2>

        <p>
          Patient ID:{" "}
          <strong>
            {patient.id}
          </strong>
        </p>

        <div className="dashboard-actions">

          <Link className="action-button" to="/patient/screening">
            Live retinal screening (camera)
          </Link>

          <Link className="action-button" to="/patient/triage">
            Camera health check (pulse, pupil, eyelid)
          </Link>

          <Link className="nav-button" to="/patient/triage/history">
            Health check history
          </Link>

        </div>

      </div>

      {flash && (
        <p className="live-flash">
          {flash}
        </p>
      )}

      <div className="history">

        <h2>
          Your screening history
          <span
            className={
              live
                ? "live-badge is-live live-inline"
                : "live-badge live-inline"
            }
          >
            {live ? "Live" : "Offline"}
          </span>
        </h2>

        {loading && (
          <p>
            Loading screening history...
          </p>
        )}

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          screenings.length === 0 && (
            <p>
              No screenings yet. Start one above.
            </p>
          )}

        {!loading &&
          !error &&
          screenings.map((screening) => (
            <div
              className="screening-card"
              key={screening.id}
            >

              <div>

                <h3>
                  {screening.prediction}
                </h3>

                <p>
                  Model confidence:{" "}
                  {(
                    screening.confidence * 100
                  ).toFixed(2)}
                  %
                </p>

                <p>
                  Status:{" "}
                  {screening.status}
                </p>

                <p>
                  {new Date(
                    screening.createdAt
                  ).toLocaleString()}
                </p>

              </div>

              <Link
                className="nav-button"
                to={`/patient/screenings/${screening.id}`}
              >
                View full report
              </Link>

            </div>
          ))}

      </div>

    </div>
  );
}

export default PatientDashboard;