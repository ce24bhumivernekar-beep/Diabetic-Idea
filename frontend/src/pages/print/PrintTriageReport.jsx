import { useParams } from "react-router-dom";

import PrintOnReady from "../../components/PrintOnReady";
import TriageReport from "../../components/TriageReport";
import { useAuth } from "../../context/auth";
import useTriageAssessments from "../../hooks/useTriage";

/**
 * A different document from the screening report, on purpose: it answers "how
 * soon should this person be seen", not "what grade is this retina", and it
 * carries a stronger caveat, because no part of it looked at a retina.
 */
function PrintTriageReport() {
  const { id } = useParams();
  const { patient } = useAuth();
  const { assessments, loading, error } = useTriageAssessments(patient?.id);

  const assessment = assessments.find((item) => item.id === id);

  const form = assessment?.questionnaire || {};

  return (
    <div className="print-report">

      {loading && <p className="state-note">Preparing the report...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && !assessment && (
        <p className="error">That health check was not found.</p>
      )}

      {assessment && (
        <>
          <PrintOnReady
            ready
            title={`RetiNova-triage-${assessment.priority}-${assessment.id.slice(0, 8)}`}
          />

          <header className="print-header">
            <div>
              <h1>RetiNova</h1>
              <p className="print-kicker">
                Camera health check — referral priority
              </p>
            </div>

            <p className="print-generated">
              Generated {new Date().toLocaleString()}
            </p>
          </header>

          <section className="print-patient">
            <div>
              <span>Patient</span>
              <strong>{patient?.name || "Patient"}</strong>
            </div>

            <div>
              <span>Age / sex</span>
              <strong>
                {form.age ?? patient?.age ?? "—"}
                {patient?.gender ? ` · ${patient.gender}` : ""}
              </strong>
            </div>

            <div>
              <span>Checked</span>
              <strong>
                {new Date(assessment.createdAt).toLocaleString()}
              </strong>
            </div>

            <div>
              <span>Reference</span>
              <strong>{assessment.id}</strong>
            </div>
          </section>

          <TriageReport assessment={assessment} showDisclaimer={false} />

          <section className="report-section">
            <h3>Answers given</h3>

            <ul className="triage-reasons">
              <li>Years since diagnosis: {form.yearsWithDiabetes ?? "not given"}</li>
              <li>Last HbA1c: {form.hba1c ? `${form.hba1c}%` : "not given"}</li>
              <li>
                Systolic blood pressure:{" "}
                {form.systolicBp ? `${form.systolicBp} mmHg` : "not given"}
              </li>
              <li>Smoker: {form.smoker ? "yes" : "no"}</li>
              <li>
                Recent vision change: {form.visionSymptoms ? "yes" : "no"}
              </li>
            </ul>
          </section>

          <section className="report-disclaimer">
            <h3>Important</h3>

            <p>
              This is a <strong>referral priority, not a diagnosis</strong>. A
              phone camera cannot photograph the retina, so nothing in this
              report can say whether diabetic retinopathy is present.
            </p>

            <p className="report-unreviewed">
              A retinal examination is still required to answer that.
            </p>
          </section>
        </>
      )}

    </div>
  );
}

export default PrintTriageReport;
