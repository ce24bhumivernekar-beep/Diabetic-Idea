import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink";
import TriageReport from "../components/TriageReport";
import { useAuth } from "../context/auth";
import useTriageAssessments from "../hooks/useTriage";

function TriageResult() {
  const { id } = useParams();
  const { patient } = useAuth();
  const { assessments, loading, error } = useTriageAssessments(patient?.id);

  const assessment = assessments.find((item) => item.id === id);

  return (
    <div className="container">

      <BackLink to="/patient/dashboard" label="Dashboard" />

      <h1>Screening priority</h1>

      {loading && <p className="state-note">Loading this health check...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && !assessment && (
        <p className="error">That health check was not found in your history.</p>
      )}

      {assessment && (
        <>
          <div className="page-actions">
            <Link
              className="nav-button"
              to={`/print/triage/${assessment.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Download report
            </Link>

            <Link className="nav-button" to="/patient/triage">
              Run another check
            </Link>
          </div>

          <TriageReport assessment={assessment} />
        </>
      )}

    </div>
  );
}

export default TriageResult;
