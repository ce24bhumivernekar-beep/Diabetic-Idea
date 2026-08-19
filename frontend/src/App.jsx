import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./routes/AppLayout";
import PrintLayout from "./routes/PrintLayout";
import RedirectIfAuthed from "./routes/RedirectIfAuthed";
import RequireRole from "./routes/RequireRole";

import LandingPage from "./pages/LandingPage";
import AboutPage from "./pages/AboutPage";
import AiScreeningInfo from "./pages/AiScreeningInfo";
import NotFound from "./pages/NotFound";

import PatientLogin from "./pages/PatientLogin";
import PatientRegistration from "./pages/PatientRegistration";
import PatientDashboard from "./pages/PatientDashboard";
import ScreeningPage from "./pages/ScreeningPage";
import ScreeningResult from "./pages/ScreeningResult";
import TriagePage from "./pages/TriagePage";
import TriageResult from "./pages/TriageResult";
import TriageHistory from "./pages/TriageHistory";

import DoctorLogin from "./pages/DoctorLogin";
import DoctorRegistration from "./pages/DoctorRegistration";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorReview from "./pages/DoctorReview";
import DoctorTriageQueue from "./pages/DoctorTriageQueue";

import PrintScreeningReport from "./pages/print/PrintScreeningReport";
import PrintTriageReport from "./pages/print/PrintTriageReport";

/**
 * The route table.
 *
 * This replaces a useState screen machine that had no URLs at all, which is
 * why the browser Back button used to leave the app and why a refresh lost
 * whatever you were looking at.
 */
function App() {
  return (
    <Routes>

      {/* Everything that shares the header and breadcrumbs */}
      <Route element={<AppLayout />}>

        <Route index element={<LandingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="ai-screening" element={<AiScreeningInfo />} />

        {/* Signed out only */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="patient/login" element={<PatientLogin />} />
          <Route path="patient/register" element={<PatientRegistration />} />
          <Route path="doctor/login" element={<DoctorLogin />} />
          <Route path="doctor/register" element={<DoctorRegistration />} />
        </Route>

        {/* Patient */}
        <Route element={<RequireRole role="PATIENT" />}>
          <Route path="patient" element={<Navigate to="/patient/dashboard" replace />} />
          <Route path="patient/dashboard" element={<PatientDashboard />} />
          <Route path="patient/screening" element={<ScreeningPage />} />
          <Route path="patient/screenings/:id" element={<ScreeningResult />} />
          <Route path="patient/triage" element={<TriagePage />} />
          <Route path="patient/triage/history" element={<TriageHistory />} />
          <Route path="patient/triage/:id" element={<TriageResult />} />
        </Route>

        {/* Doctor */}
        <Route element={<RequireRole role="DOCTOR" />}>
          <Route path="doctor" element={<Navigate to="/doctor/dashboard" replace />} />
          <Route path="doctor/dashboard" element={<DoctorDashboard />} />
          <Route path="doctor/triage" element={<DoctorTriageQueue />} />
          <Route path="doctor/screenings/:id" element={<DoctorReview />} />
        </Route>

        <Route path="*" element={<NotFound />} />

      </Route>

      {/* Meant for paper: no chrome at all */}
      <Route element={<PrintLayout />}>
        <Route path="print/screenings/:id" element={<PrintScreeningReport />} />
        <Route path="print/triage/:id" element={<PrintTriageReport />} />
      </Route>

    </Routes>
  );
}

export default App;
