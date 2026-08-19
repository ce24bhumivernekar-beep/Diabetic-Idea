import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BackLink from "../components/BackLink";
import TriageReport from "../components/TriageReport";
import { API_URL, apiError, authHeaders } from "../config";
import useLiveEvents from "../hooks/useLiveEvents";

/**
 * The camera-only priority queue.
 *
 * The endpoint and the live event behind this existed from the start, but
 * nothing in the app ever called them, so every assessment a patient recorded
 * was invisible to the doctors it was meant for.
 *
 * Grouped by priority rather than by time: a priority queue sorted by arrival
 * is not a priority queue.
 */

const BANDS = ["URGENT", "HIGH", "MODERATE", "ROUTINE"];

function DoctorTriageQueue() {
  const [assessments, setAssessments] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // The triage rows carry only a patientId, so names come from the
        // patient list - the two endpoints are meant to be used together.
        const [triageResponse, patientResponse] = await Promise.all([
          fetch(`${API_URL}/api/doctor/triage`, { headers: authHeaders() }),
          fetch(`${API_URL}/api/patients`, { headers: authHeaders() }),
        ]);

        const triageText = await triageResponse.text();

        if (!triageResponse.ok) {
          throw new Error(apiError(triageText, "Could not load the queue."));
        }

        const rows = JSON.parse(triageText);

        let byId = {};

        if (patientResponse.ok) {
          const list = JSON.parse(await patientResponse.text());
          byId = Object.fromEntries(list.map((item) => [item.id, item]));
        }

        if (!cancelled) {
          setAssessments(rows);
          setPatients(byId);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Could not load the queue.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const { live } = useLiveEvents(["triage-recorded"], () => reload());

  const grouped = BANDS.map((band) => ({
    band,
    rows: assessments.filter((item) => item.priority === band),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="container doctor-dashboard">

      <BackLink to="/doctor/dashboard" label="Review queue" />

      <h1>Camera triage queue</h1>

      <p className="subtitle">
        Camera-only health checks, most urgent first. These are queue
        positions, not diagnoses.
      </p>

      <div className="live-bar">
        <span className={live ? "live-badge is-live" : "live-badge"}>
          {live ? "Live" : "Offline"}
        </span>

        <button type="button" className="back-button live-refresh" onClick={reload}>
          Refresh
        </button>
      </div>

      {loading && <p className="state-note">Loading the queue...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && assessments.length === 0 && (
        <p className="state-note">
          No camera health checks recorded yet.
        </p>
      )}

      {grouped.map((group) => (
        <div className="doctor-section" key={group.band}>

          <h2>
            {group.band}
            <span className="queue-count">{group.rows.length}</span>
          </h2>

          {group.rows.map((row) => {
            const person = patients[row.patientId];

            return (
              <div
                className={
                  "doctor-card priority-" + group.band.toLowerCase()
                }
                key={row.id}
              >

                <div>
                  <h3>{person ? person.name : "Unknown patient"}</h3>

                  <p>
                    Exam within {row.recommendedWithin} · score {row.score}/100
                  </p>

                  <p>
                    {(row.measurementsUsed || []).length} measurement
                    {(row.measurementsUsed || []).length === 1 ? "" : "s"} used
                    {(row.measurementsSkipped || []).length > 0 &&
                      ` · ${row.measurementsSkipped.length} not counted`}
                  </p>

                  <p>{new Date(row.createdAt).toLocaleString()}</p>
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    className="nav-button"
                    onClick={() =>
                      setExpanded(expanded === row.id ? null : row.id)
                    }
                  >
                    {expanded === row.id ? "Hide details" : "Details"}
                  </button>

                  <Link
                    className="nav-button"
                    to={`/print/triage/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Report
                  </Link>
                </div>

                {expanded === row.id && (
                  <div className="card-expanded">
                    <TriageReport assessment={row} showDisclaimer={false} />
                  </div>
                )}

              </div>
            );
          })}

        </div>
      ))}

    </div>
  );
}

export default DoctorTriageQueue;
