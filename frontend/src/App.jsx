import { useEffect, useState } from "react";

import { API_URL, authHeaders, clearSession } from "./config";

import AppHeader from "./components/AppHeader";
import LandingPage from "./pages/LandingPage";
import DoctorRegistration from "./pages/DoctorRegistration";
import DoctorLogin from "./pages/DoctorLogin";
import PatientRegistration from "./pages/PatientRegistration";
import PatientLogin from "./pages/PatientLogin";
import ScreeningPage from "./pages/ScreeningPage";
import TriagePage from "./pages/TriagePage";
import PatientDashboard from "./pages/PatientDashboard";
import ScreeningResult from "./pages/ScreeningResult";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorReview from "./pages/DoctorReview";

function App() {
  const [screen, setScreen] = useState("home");

  const [patient, setPatient] = useState(null);
  const [doctor, setDoctor] = useState(null);

  const [selectedPatientScreening, setSelectedPatientScreening] =
    useState(null);

  const [selectedDoctorScreening, setSelectedDoctorScreening] =
    useState(null);

  // Session restore runs once; until it finishes the app must not decide
  // that nobody is signed in.
  const [restoring, setRestoring] = useState(true);

  // =========================================================
  // SESSION
  //
  // The token already lives in localStorage, but nothing read it back, so
  // refreshing any page threw the user out to the landing screen mid-task.
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const token = localStorage.getItem("authToken");
      const role = localStorage.getItem("userRole");
      const userId = localStorage.getItem("userId");

      if (!token || !role) {
        if (!cancelled) {
          setRestoring(false);
        }
        return;
      }

      if (role === "DOCTOR") {
        if (!cancelled) {
          setDoctor({
            id: userId,
            email: localStorage.getItem("userEmail"),
            role,
          });
          setScreen("doctor-dashboard");
          setRestoring(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/patients/user/${userId}`,
          { headers: authHeaders() }
        );

        if (!response.ok) {
          throw new Error("session expired");
        }

        const profile = await response.json();

        if (!cancelled) {
          setPatient(profile);
          setScreen("patient-dashboard");
        }
      } catch {
        // An expired or rejected token should not leave a half-signed-in app.
        clearSession();
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================================================
  // NAVIGATION
  // =========================================================

  const goHome = () => {
    setSelectedPatientScreening(null);
    setSelectedDoctorScreening(null);
    setScreen("home");
  };

  const signOut = () => {
    clearSession();
    setPatient(null);
    setDoctor(null);
    setSelectedPatientScreening(null);
    setSelectedDoctorScreening(null);
    setScreen("home");
  };

  const backToPatientDashboard = () => {
    setSelectedPatientScreening(null);
    setScreen("patient-dashboard");
  };

  const backToDoctorDashboard = () => {
    setSelectedDoctorScreening(null);
    setScreen("doctor-dashboard");
  };

  // =========================================================
  // PATIENT
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

  const viewPatientResult = (screening) => {
    setSelectedPatientScreening(screening);
    setScreen("patient-result");
  };

  // =========================================================
  // DOCTOR
  // =========================================================

  const handleDoctorRegistered = () => {
    setDoctor(null);
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

  // =========================================================
  // SHELL
  // =========================================================

  const signedInRole = doctor ? "DOCTOR" : patient ? "PATIENT" : null;

  const dashboardFor = () => {
    if (doctor) {
      return backToDoctorDashboard;
    }

    if (patient) {
      return backToPatientDashboard;
    }

    return null;
  };

  const page = (content) => (
    <div className="app">

      <AppHeader
        role={signedInRole}
        onHome={goHome}
        onDashboard={dashboardFor()}
        onLogout={signedInRole ? signOut : null}
      />

      {content}

    </div>
  );

  if (restoring) {
    return (
      <div className="app">
        <div className="container">
          <p className="subtitle">Restoring your session...</p>
        </div>
      </div>
    );
  }

  // =========================================================
  // SCREENS
  // =========================================================

  if (screen === "home") {
    return (
      <LandingPage
        onPatient={() => setScreen(patient ? "patient-dashboard" : "patient-login")}
        onDoctor={() => setScreen(doctor ? "doctor-dashboard" : "doctor-login")}
      />
    );
  }

  if (screen === "patient-login") {
    return page(
      <PatientLogin
        onLoginSuccess={handlePatientLogin}
        onRegister={() => setScreen("patient-registration")}
        onBack={goHome}
      />
    );
  }

  if (screen === "patient-registration") {
    return page(
      <>
        <PatientRegistration onPatientCreated={handlePatientCreated} />

        <div className="role-switch">
          <button
            className="back-button"
            onClick={() => setScreen("patient-login")}
          >
            ← Back to patient sign in
          </button>
        </div>
      </>
    );
  }

  if (screen === "patient-dashboard" && patient) {
    return page(
      <PatientDashboard
        patient={patient}
        onStartScreening={() => setScreen("patient-screening")}
        onStartTriage={() => setScreen("patient-triage")}
        onViewResult={viewPatientResult}
      />
    );
  }

  if (screen === "patient-screening" && patient) {
    return page(
      <ScreeningPage
        patient={patient}
        onBack={backToPatientDashboard}
      />
    );
  }

  if (screen === "patient-triage" && patient) {
    return page(
      <TriagePage
        patient={patient}
        onBack={backToPatientDashboard}
      />
    );
  }

  if (screen === "patient-result" && patient && selectedPatientScreening) {
    return page(
      <ScreeningResult
        screening={selectedPatientScreening}
        onBack={backToPatientDashboard}
      />
    );
  }

  if (screen === "doctor-login") {
    return page(
      <DoctorLogin
        onLoginSuccess={handleDoctorLogin}
        onRegister={() => setScreen("doctor-registration")}
        onBack={goHome}
      />
    );
  }

  if (screen === "doctor-registration") {
    return page(
      <>
        <DoctorRegistration onDoctorRegistered={handleDoctorRegistered} />

        <div className="role-switch">
          <button
            className="back-button"
            onClick={() => setScreen("doctor-login")}
          >
            ← Back to doctor sign in
          </button>
        </div>
      </>
    );
  }

  if (screen === "doctor-dashboard" && doctor) {
    return page(
      <DoctorDashboard onReview={reviewDoctorScreening} />
    );
  }

  if (screen === "doctor-review" && doctor && selectedDoctorScreening) {
    return page(
      <DoctorReview
        screening={selectedDoctorScreening}
        onBack={backToDoctorDashboard}
      />
    );
  }

  // A screen that needs a sign-in the user no longer has.
  return (
    <LandingPage
      onPatient={() => setScreen("patient-login")}
      onDoctor={() => setScreen("doctor-login")}
    />
  );
}

export default App;
