import { useEffect, useState } from "react";

function DoctorDashboard({ onReview }) {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
          "http://localhost:8080/api/doctor/screenings",
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
          throw new Error(
            responseText ||
            "Could not load screenings."
          );
        }

        const data =
          JSON.parse(responseText);

        setScreenings(data);

      } catch (error) {
        console.error(
          "Doctor dashboard error:",
          error
        );

        setError(
          error.message ||
          "Could not load screenings."
        );
      } finally {
        setLoading(false);
      }
    };

    loadScreenings();
  }, []);

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

      <h1>Doctor Dashboard</h1>

      <p className="subtitle">
        Review AI-assisted diabetic retinopathy screenings
      </p>

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

            <h2>Pending Reviews</h2>

            {pendingScreenings.length === 0 ? (
              <p>
                No pending screenings.
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
                        Patient ID:{" "}
                        {screening.patientId}
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

                    <button
                      onClick={() =>
                        onReview(screening)
                      }
                    >
                      Review
                    </button>

                  </div>
                )
              )
            )}

          </section>

          <section className="doctor-section">

            <h2>
              Reviewed Screenings
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
                        Patient ID:{" "}
                        {screening.patientId}
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

                    <button
                      onClick={() =>
                        onReview(screening)
                      }
                    >
                      View
                    </button>

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