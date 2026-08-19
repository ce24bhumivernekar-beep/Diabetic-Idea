import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink";
import ScreeningReport from "../components/ScreeningReport";
import useScreening from "../hooks/useScreening";

function ScreeningResult() {
  const { id } = useParams();
  const { screening, loading, error } = useScreening(id);

  return (
    <div className="container screening-result">

      <BackLink to="/patient/dashboard" label="Dashboard" />

      <h1>Screening result</h1>

      <p className="subtitle">
        AI-assisted grading with an explainability heatmap
      </p>

      {loading && <p className="state-note">Loading this screening...</p>}

      {error && <p className="error">{error}</p>}

      {screening && (
        <>
          <div className="page-actions">
            <Link
              className="nav-button"
              to={`/print/screenings/${screening.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Download report
            </Link>
          </div>

          <ScreeningReport screening={screening} />
        </>
      )}

    </div>
  );
}

export default ScreeningResult;
