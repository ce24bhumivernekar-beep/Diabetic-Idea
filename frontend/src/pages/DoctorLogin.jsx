import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { API_URL, apiError } from "../config";
import { useAuth } from "../context/auth";

function DoctorLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { signInDoctor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const destination =
    location.state?.from?.pathname ||
    new URLSearchParams(location.search).get("next") ||
    "/doctor/dashboard";

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const loginDoctor = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(apiError(text, "Sign in failed."));
      }

      const user = JSON.parse(text);

      if (user.role !== "DOCTOR") {
        throw new Error("This account is registered as a patient.");
      }

      if (!user.token) {
        throw new Error("Signed in but no authentication token was returned.");
      }

      localStorage.setItem("authToken", user.token);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("userEmail", user.email);

      // A doctor has no patient profile to fetch - the account is the identity.
      signInDoctor(user);

      navigate(destination, { replace: true });
    } catch (signInError) {
      console.error("Doctor sign in error:", signInError);
      setError(signInError.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Doctor sign in</h1>

      <p className="subtitle">Sign in to review patient screenings.</p>

      <form onSubmit={loginDoctor} className="patient-form">

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
        <Link className="back-button" to="/doctor/register">
          Create a doctor account
        </Link>

        <Link className="back-button" to="/">
          ← Home
        </Link>
      </div>

    </div>
  );
}

export default DoctorLogin;
