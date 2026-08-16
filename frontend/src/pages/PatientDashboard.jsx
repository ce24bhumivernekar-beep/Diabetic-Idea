import { useEffect, useState } from "react";

function PatientDashboard({
  patient,
  onStartScreening,
  onViewResult,
}) {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(
          `http://localhost:8080/api/screenings/patient/${patient.id}`
        );

        if (!response.ok) {
          throw new Error("Could not load screening history");
        }

        const data = await response.json();

        setScreenings(data);
      } catch (error) {
        console.error(error);
        setError("Could not load screening history.");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [patient.id]);

  return (
    <div className="container dashboard">

      <h1>Patient Dashboard</h1>

      <div className="patient-info">

        <h2>Hello, {patient.name}</h2>

        <p>
          Patient ID: <strong>{patient.id}</strong>
        </p>

        <button onClick={onStartScreening}>
          Start New Screening
        </button>

      </div>

      <div className="history">

        <h2>Screening History</h2>

        {loading && (
          <p>Loading screening history...</p>
        )}

        {error && (
          <p className="error">{error}</p>
        )}

        {!loading &&
          !error &&
          screenings.length === 0 && (
            <p>
              No previous screenings found.
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
                  {(screening.confidence * 100).toFixed(2)}%
                </p>

                <p>
                  Status: {screening.status}
                </p>

                <p>
                  {new Date(
                    screening.createdAt
                  ).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => onViewResult(screening)}
              >
                View Result
              </button>

            </div>
          ))}

      </div>

    </div>
  );
}

export default PatientDashboard;