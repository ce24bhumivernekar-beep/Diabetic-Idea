import { useParams } from "react-router-dom";

import PrintOnReady from "../../components/PrintOnReady";
import ReportDisclaimer from "../../components/ReportDisclaimer";
import ScreeningReport from "../../components/ScreeningReport";
import { useAuth } from "../../context/auth";
import useScreening from "../../hooks/useScreening";

function slug(value) {
  return String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function PrintScreeningReport() {
  const { id } = useParams();
  const { patient } = useAuth();
  const { screening, loading, error } = useScreening(id);

  // The doctor's copy carries the patient fields; the patient's own copy does
  // not, so it falls back to the signed-in profile.
  const name = screening?.patientName || patient?.name || "Patient";
  const age = screening?.patientAge ?? patient?.age;
  const gender = screening?.patientGender || patient?.gender;

  const date = screening?.createdAt
    ? new Date(screening.createdAt)
    : null;

  return (
    <div className="print-report">

      {loading && <p className="state-note">Preparing the report...</p>}

      {error && <p className="error">{error}</p>}

      {screening && (
        <>
          <PrintOnReady
            ready
            title={`RetiNova-report-${slug(name)}-${
              date ? date.toISOString().slice(0, 10) : "screening"
            }`}
          />

          <header className="print-header">
            <div>
              <h1>RetiNova</h1>
              <p className="print-kicker">AI-assisted retinal screening report</p>
            </div>

            <p className="print-generated">
              Generated {new Date().toLocaleString()}
            </p>
          </header>

          <section className="print-patient">
            <div>
              <span>Patient</span>
              <strong>{name}</strong>
            </div>

            <div>
              <span>Age / sex</span>
              <strong>
                {age ?? "—"}
                {gender ? ` · ${gender}` : ""}
              </strong>
            </div>

            <div>
              <span>Eye</span>
              <strong>
                {screening.eye === "LEFT"
                  ? "Left (OS)"
                  : screening.eye === "RIGHT"
                    ? "Right (OD)"
                    : "Not recorded"}
              </strong>
            </div>

            <div>
              <span>Screened</span>
              <strong>{date ? date.toLocaleString() : "—"}</strong>
            </div>

            <div>
              <span>Image quality</span>
              <strong>
                {screening.quality
                  ? screening.quality.gradable
                    ? `Gradable (${screening.quality.quality}/100)`
                    : "NOT GRADABLE"
                  : "Not assessed"}
              </strong>
            </div>

            <div>
              <span>Reference</span>
              <strong>{screening.id}</strong>
            </div>
          </section>

          {screening.quality && !screening.quality.gradable && (
            <section className="print-ungradable">
              <h3>Image not gradable</h3>
              <p>{(screening.quality.reasons || []).join(" ")}</p>
              <p>
                The grade below was produced from an image that does not meet
                the quality needed to read a retina. Repeat the photograph
                before acting on it.
              </p>
            </section>
          )}

          <ScreeningReport screening={screening} />

          <ReportDisclaimer
            metrics={screening.modelMetrics}
            reviewed={screening.status === "REVIEWED"}
          />

          {screening.status !== "REVIEWED" && (
            <section className="print-signature">
              <p>Reviewing clinician</p>
              <div className="signature-line">
                <span>Name and signature</span>
                <span>Date</span>
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
}

export default PrintScreeningReport;
