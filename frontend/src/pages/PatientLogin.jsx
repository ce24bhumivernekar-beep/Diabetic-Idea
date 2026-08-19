import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { API_URL, apiError } from "../config";
import { useAuth } from "../context/auth";

function PatientLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { signInPatient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Where to land after signing in. A guard that bounced someone here stores
   * the page they wanted in location.state; a plain link from the landing page
   * carries no router state, so ?next= is honoured too.
   */
  const destination =
    location.state?.from?.pathname ||
    new URLSearchParams(location.search).get("next") ||
    "/patient/dashboard";

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const loginPatient = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const loginText = await loginResponse.text();

      if (!loginResponse.ok) {
        throw new Error(apiError(loginText, "Sign in failed."));
      }

      const user = JSON.parse(loginText);

      if (user.role !== "PATIENT") {
        throw new Error("This account is registered as a doctor.");
      }

      if (!user.token) {
        throw new Error("Signed in but no authentication token was returned.");
      }

      localStorage.setItem("authToken", user.token);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("userEmail", user.email);

      const patientResponse = await fetch(
        `${API_URL}/api/patients/user/${user.id}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      const patientText = await patientResponse.text();

      if (!patientResponse.ok) {
        throw new Error(apiError(patientText, "Patient profile not found."));
      }

      signInPatient(JSON.parse(patientText));

      navigate(destination, { replace: true });
    } catch (signInError) {
      console.error("Patient sign in error:", signInError);
      setError(signInError.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Patient sign in</h1>

      <p className="subtitle">
        Sign in to run a screening and see your results.
      </p>

      <form onSubmit={loginPatient} className="patient-form">

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && <p className="error">{error}</p>}

      </form>

      <div className="form-links">
        <Link className="back-button" to="/patient/register">
          Create a patient account
        </Link>

        <Link className="back-button" to="/">
          ← Home
        </Link>
      </div>

    </div>
  );
}

export default PatientLogin;
