import { useState } from "react";

import PatientRegistration from "./pages/PatientRegistration";
import ScreeningPage from "./pages/ScreeningPage";
import PatientDashboard from "./pages/PatientDashboard";
import ScreeningResult from "./pages/ScreeningResult";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorReview from "./pages/DoctorReview";

function App() {
  const [role, setRole] = useState(null);

  const [patient, setPatient] = useState(null);

  const [screeningStarted, setScreeningStarted] =
    useState(false);

  const [selectedScreening, setSelectedScreening] =
    useState(null);

  const [selectedDoctorScreening, setSelectedDoctorScreening] =
    useState(null);

  const handlePatientCreated = (createdPatient) => {
    setPatient(createdPatient);
    setScreeningStarted(false);
  };

  const startScreening = () => {
    setSelectedScreening(null);
    setScreeningStarted(true);
  };

  const backToPatientDashboard = () => {
    setScreeningStarted(false);
    setSelectedScreening(null);
  };

  const viewPatientResult = (screening) => {
    setScreeningStarted(false);
    setSelectedScreening(screening);
  };

  const reviewDoctorScreening = (screening) => {
    setSelectedDoctorScreening(screening);
  };

  const backToDoctorDashboard = () => {
    setSelectedDoctorScreening(null);
  };

  // ---------------------------------------------------------
  // ROLE SELECTION
  // ---------------------------------------------------------

  if (!role) {
    return (
      <div className="app">
        <div className="container role-selection">

          <h1>
            Diabetic Retinopathy
            <br />
            Screening Platform
          </h1>

          <p className="subtitle">
            AI-assisted retinal screening with
            explainable heatmaps
          </p>

          <h2>
            Continue as
          </h2>

          <div className="role-buttons">

            <button
              onClick={() => setRole("patient")}
            >
              Patient
            </button>

            <button
              onClick={() => setRole("doctor")}
            >
              Doctor
            </button>

          </div>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // DOCTOR REVIEW
  // ---------------------------------------------------------

  if (
    role === "doctor" &&
    selectedDoctorScreening
  ) {
    return (
      <div className="app">

        <DoctorReview
          screening={selectedDoctorScreening}
          onBack={backToDoctorDashboard}
        />

      </div>
    );
  }

  // ---------------------------------------------------------
  // DOCTOR DASHBOARD
  // ---------------------------------------------------------

  if (role === "doctor") {
    return (
      <div className="app">

        <DoctorDashboard
          onReview={reviewDoctorScreening}
        />

        <div className="role-switch">

          <button
            onClick={() => {
              setRole(null);
              setSelectedDoctorScreening(null);
            }}
          >
            ← Back
          </button>

        </div>

      </div>
    );
  }

  // ---------------------------------------------------------
  // PATIENT REGISTRATION
  // ---------------------------------------------------------

  if (!patient) {
    return (
      <div className="app">

        <PatientRegistration
          onPatientCreated={
            handlePatientCreated
          }
        />

      </div>
    );
  }

  // ---------------------------------------------------------
  // PATIENT SCREENING
  // ---------------------------------------------------------

  if (screeningStarted) {
    return (
      <div className="app">

        <ScreeningPage
          patient={patient}
          onBack={
            backToPatientDashboard
          }
        />

      </div>
    );
  }

  // ---------------------------------------------------------
  // PATIENT RESULT
  // ---------------------------------------------------------

  if (selectedScreening) {
    return (
      <div className="app">

        <ScreeningResult
          screening={selectedScreening}
          onBack={
            backToPatientDashboard
          }
        />

      </div>
    );
  }

  // ---------------------------------------------------------
  // PATIENT DASHBOARD
  // ---------------------------------------------------------

  return (
    <div className="app">

      <PatientDashboard
        patient={patient}
        onStartScreening={
          startScreening
        }
        onViewResult={
          viewPatientResult
        }
      />

    </div>
  );
}

export default App;