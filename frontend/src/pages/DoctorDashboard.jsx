import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import BackLink from "../components/BackLink";
import { API_URL, apiError } from "../config";
import useLiveEvents from "../hooks/useLiveEvents";

function DoctorDashboard() {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  // Bumping this token makes the effect below fetch again. Reloading through
  // an effect keeps the fetch out of the render path.
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadScreenings = async () => {
      try {
        const token =
          localStorage.getItem("authToken");

        if (!token) {
          throw new Error(
            "Authentication token not found."
          );
        }

        const response = await fetch(
          `${API_URL}/api/doctor/screenings`,
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
          throw new Error(apiError(responseText, "Could not load screenings."));
        }

        const data =
          JSON.parse(responseText);

        if (!cancelled) {
          setScreenings(data);
          setError("");
        }

      } catch (loadError) {
        console.error(
          "Doctor dashboard error:",
          loadError
        );

        if (!cancelled) {
          setError(
            loadError.message ||
            "Could not load screenings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadScreenings();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // A patient submitting a scan, or another doctor signing one off, refreshes
  // this queue immediately over the event stream.
  const { live, lastEventAt } = useLiveEvents(
    ["screening-created", "screening-reviewed"],
    (name, payload) => {
      reload();

      if (name === "screening-created") {
        setFlash(
          `New screening from ${
            (payload && payload.patientName) || "a patient"
          }`
        );
      }
    }
  );

  useEffect(() => {
    if (!flash) {
      return undefined;
    }

    const timer = setTimeout(() => setFlash(""), 6000);

    return () => clearTimeout(timer);
  }, [flash]);

  const pendingScreenings =
    screenings.filter(
      (screening) =>
        screening.status !== "REVIEWED"
    );

  const reviewedScreenings =
    screenings.filter(
      (screening) =>
        screening.status === "REVIEWED"
    );

  return (
    <div className="container doctor-dashboard">

      <BackLink to="/" label="Home" />

      <h1>Doctor Dashboard</h1>

      <p className="subtitle">
        Screenings arrive here the moment a patient submits one
      </p>

      <div className="dashboard-actions">
        <Link className="action-button" to="/doctor/triage">
          Camera triage queue
        </Link>
      </div>

      <div className="live-bar">

        <span
          className={
            live ? "live-badge is-live" : "live-badge"
          }
        >
          {live ? "Live" : "Reconnecting"}
        </span>

        {lastEventAt && (
          <span className="live-meta">
            last update {lastEventAt.toLocaleTimeString()}
          </span>
        )}

        <button
          type="button"
          className="back-button live-refresh"
          onClick={reload}
        >
          Refresh
        </button>

      </div>

      {flash && (
        <p className="live-flash">
          {flash}
        </p>
      )}

      {loading && (
        <p>Loading screenings...</p>
      )}

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="doctor-section">

            <h2>Waiting for your review</h2>

            {pendingScreenings.length === 0 ? (
              <p>
                Nothing waiting - the queue is clear.
              </p>
            ) : (
              pendingScreenings.map(
                (screening) => (
                  <div
                    className="doctor-card"
                    key={screening.id}
                  >

                    <div>

                      <h3>
                        {screening.prediction}
                      </h3>

                      <p>
                        Patient:{" "}
                        {screening.patientName ||
                          "Unknown"}
                        {screening.patientAge
                          ? ` (${screening.patientAge}` +
                            `${
                              screening.patientGender
                                ? ", " +
                                  screening.patientGender
                                : ""
                            })`
                          : ""}
                      </p>

                      <p>
                        Model confidence:{" "}
                        {(
                          screening.confidence *
                          100
                        ).toFixed(2)}
                        %
                      </p>

                      <p>
                        Date:{" "}
                        {new Date(
                          screening.createdAt
                        ).toLocaleString()}
                      </p>

                      <p>
                        Status:{" "}
                        <strong>
                          {screening.status}
                        </strong>
                      </p>

                    </div>

                    <Link
                      className="nav-button"
                      to={`/doctor/screenings/${screening.id}`}
                    >
                      Review
                    </Link>

                  </div>
                )
              )
            )}

          </section>

          <section className="doctor-section">

            <h2>
              Already reviewed
            </h2>

            {reviewedScreenings.length === 0 ? (
              <p>
                No reviewed screenings yet.
              </p>
            ) : (
              reviewedScreenings.map(
                (screening) => (
                  <div
                    className="doctor-card reviewed"
                    key={screening.id}
                  >

                    <div>

                      <h3>
                        {screening.prediction}
                      </h3>

                      <p>
                        Patient:{" "}
                        {screening.patientName ||
                          "Unknown"}
                        {screening.patientAge
                          ? ` (${screening.patientAge}` +
                            `${
                              screening.patientGender
                                ? ", " +
                                  screening.patientGender
                                : ""
                            })`
                          : ""}
                      </p>

                      <p>
                        Decision:{" "}
                        <strong>
                          {
                            screening.doctorDecision
                          }
                        </strong>
                      </p>

                      <p>
                        Reviewed by:{" "}
                        {screening.reviewedBy}
                      </p>

                      <p>
                        Remarks:{" "}
                        {screening.doctorRemarks}
                      </p>

                    </div>

                    <Link
                      className="nav-button"
                      to={`/doctor/screenings/${screening.id}`}
                    >
                      View
                    </Link>

                  </div>
                )
              )
            )}

          </section>
        </>
      )}

    </div>
  );
}

export default DoctorDashboard;