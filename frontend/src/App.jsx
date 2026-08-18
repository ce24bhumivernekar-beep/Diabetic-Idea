import { useState } from "react";
import { clearSession } from "./config";

import LandingPage from "./pages/LandingPage";
import DoctorRegistration from "./pages/DoctorRegistration";
import DoctorLogin from "./pages/DoctorLogin";
import PatientRegistration from "./pages/PatientRegistration";
import PatientLogin from "./pages/PatientLogin";
import ScreeningPage from "./pages/ScreeningPage";
import PatientDashboard from "./pages/PatientDashboard";
import ScreeningResult from "./pages/ScreeningResult";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorReview from "./pages/DoctorReview";

function App() {
  const [screen, setScreen] = useState("role");

  const [patient, setPatient] = useState(null);

  const [selectedPatientScreening, setSelectedPatientScreening] =
    useState(null);

  const [doctor, setDoctor] = useState(null);

  const [selectedDoctorScreening, setSelectedDoctorScreening] =
    useState(null);

  // =========================================================
  // PATIENT FUNCTIONS
  // =========================================================

  const handlePatientCreated = (createdPatient) => {
    setPatient(createdPatient);
    setSelectedPatientScreening(null);
    setScreen("patient-dashboard");
  };

  const handlePatientLogin = (loggedInPatient) => {
    setPatient(loggedInPatient);
    setSelectedPatientScreening(null);
    setScreen("patient-dashboard");
  };

  const startScreening = () => {
    setSelectedPatientScreening(null);
    setScreen("patient-screening");
  };

  const viewPatientResult = (screening) => {
    setSelectedPatientScreening(screening);
    setScreen("patient-result");
  };

  const backToPatientDashboard = () => {
    setSelectedPatientScreening(null);
    setScreen("patient-dashboard");
  };

  // =========================================================
  // DOCTOR FUNCTIONS
  // =========================================================

  const handleDoctorRegistered = () => {
    setDoctor(null);
    setSelectedDoctorScreening(null);
    setScreen("doctor-login");
  };

  const handleDoctorLogin = (loggedInDoctor) => {
    setDoctor(loggedInDoctor);
    setSelectedDoctorScreening(null);
    setScreen("doctor-dashboard");
  };

  const reviewDoctorScreening = (screening) => {
    setSelectedDoctorScreening(screening);
    setScreen("doctor-review");
  };

  const backToDoctorDashboard = () => {
    setSelectedDoctorScreening(null);
    setScreen("doctor-dashboard");
  };

  const logoutDoctor = () => {
    clearSession();

    setDoctor(null);
    setSelectedDoctorScreening(null);
    setScreen("role");
  };

  // =========================================================
  // LANDING PAGE
  // =========================================================

  if (screen === "role") {
    return (
      <LandingPage
        onPatient={() => {
          setScreen("patient-login");
        }}
        onDoctor={() => {
          setScreen("doctor-login");
        }}
      />
    );
  }

  // =========================================================
  // PATIENT LOGIN
  // =========================================================

  if (screen === "patient-login") {
    return (
      <div className="app">

        <PatientLogin
          onLoginSuccess={handlePatientLogin}
          onRegister={() => {
            setScreen("patient-registration");
          }}
          onBack={() => {
            setScreen("role");
          }}
        />

      </div>
    );
  }

  // =========================================================
  // PATIENT REGISTRATION
  // =========================================================

  if (screen === "patient-registration") {
    return (
      <div className="app">

        <PatientRegistration
          onPatientCreated={handlePatientCreated}
        />

        <div className="role-switch">

          <button
            className="back-button"
            onClick={() => {
              setScreen("patient-login");
            }}
          >
            ← Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =========================================================
  // PATIENT DASHBOARD
  // =========================================================

  if (
    screen === "patient-dashboard" &&
    patient
  ) {
    return (
      <div className="app">

        <PatientDashboard
          patient={patient}
          onStartScreening={startScreening}
          onViewResult={viewPatientResult}
        />

        <div className="role-switch">

          <button
            className="back-button"
            onClick={() => {
              clearSession();

              setPatient(null);
              setSelectedPatientScreening(null);
              setScreen("role");
            }}
          >
            Logout
          </button>

        </div>

      </div>
    );
  }

  // =========================================================
  // PATIENT SCREENING
  // =========================================================

  if (
    screen === "patient-screening" &&
    patient
  ) {
    return (
      <div className="app">

        <ScreeningPage
          patient={patient}
          onBack={backToPatientDashboard}
        />

      </div>
    );
  }

  // =========================================================
  // PATIENT RESULT
  // =========================================================

  if (
    screen === "patient-result" &&
    patient &&
    selectedPatientScreening
  ) {
    return (
      <div className="app">

        <ScreeningResult
          screening={selectedPatientScreening}
          onBack={backToPatientDashboard}
        />

      </div>
    );
  }

  // =========================================================
  // DOCTOR LOGIN
  // =========================================================

  if (screen === "doctor-login") {
    return (
      <div className="app">

        <DoctorLogin
          onLoginSuccess={handleDoctorLogin}
          onRegister={() => {
            setScreen("doctor-registration");
          }}
          onBack={() => {
            setScreen("role");
          }}
        />

      </div>
    );
  }

  // =========================================================
  // DOCTOR REGISTRATION
  // =========================================================

  if (screen === "doctor-registration") {
    return (
      <div className="app">

        <DoctorRegistration
          onDoctorRegistered={
            handleDoctorRegistered
          }
        />

        <div className="role-switch">

          <button
            className="back-button"
            onClick={() => {
              setScreen("doctor-login");
            }}
          >
            ← Back to Login
          </button>

        </div>

      </div>
    );
  }

  // =========================================================
  // DOCTOR DASHBOARD
  // =========================================================

  if (
    screen === "doctor-dashboard" &&
    doctor
  ) {
    return (
      <div className="app">

        <DoctorDashboard
          onReview={reviewDoctorScreening}
        />

        <div className="role-switch">

          <button
            className="back-button"
            onClick={logoutDoctor}
          >
            Logout
          </button>

        </div>

      </div>
    );
  }

  // =========================================================
  // DOCTOR REVIEW
  // =========================================================

  if (
    screen === "doctor-review" &&
    doctor &&
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

  // =========================================================
  // FALLBACK
  // =========================================================

  return (
    <LandingPage
      onPatient={() => {
        setScreen("patient-login");
      }}
      onDoctor={() => {
        setScreen("doctor-login");
      }}
    />
  );
}

export default App;