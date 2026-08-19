import { Link } from "react-router-dom";

import BackLink from "../components/BackLink";
import { useAuth } from "../context/auth";
import useTriageAssessments from "../hooks/useTriage";

function TriageHistory() {
  const { patient } = useAuth();
  const { assessments, loading, error } = useTriageAssessments(patient?.id);

  return (
    <div className="container">

      <BackLink to="/patient/dashboard" label="Dashboard" />

      <h1>Health check history</h1>

      <p className="subtitle">
        Every camera health check you have run, newest first
      </p>

      {loading && <p className="state-note">Loading your health checks...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && assessments.length === 0 && (
        <p className="state-note">
          No health checks yet.{" "}
          <Link to="/patient/triage">Run your first one</Link>.
        </p>
      )}

      {assessments.map((assessment) => (
        <div
          key={assessment.id}
          className={
            "screening-card priority-" +
            String(assessment.priority || "").toLowerCase()
          }
        >
          <div>
            <h3>{assessment.priority} priority</h3>

            <p>Retinal exam within {assessment.recommendedWithin}</p>

            <p>
              Score {assessment.score}/100 ·{" "}
              {new Date(assessment.createdAt).toLocaleString()}
            </p>
          </div>

          <Link className="nav-button" to={`/patient/triage/${assessment.id}`}>
            View details
          </Link>
        </div>
      ))}

    </div>
  );
}

export default TriageHistory;
