import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { API_URL, apiError } from "../config";
import { useAuth } from "../context/auth";

function DoctorRegistration() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signInDoctor } = useAuth();
  const navigate = useNavigate();

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const registerDoctor = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: "DOCTOR",
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(apiError(responseText, "Registration failed."));
      }

      const doctor = JSON.parse(responseText);

      // Registration already returns a token. Discarding it and sending the
      // new doctor back to the sign-in form, as this page used to, made them
      // type the password they had just chosen.
      if (doctor.token) {
        localStorage.setItem("authToken", doctor.token);
        localStorage.setItem("userRole", doctor.role);
        localStorage.setItem("userId", doctor.id);
        localStorage.setItem("userEmail", doctor.email);

        signInDoctor(doctor);

        navigate("/doctor/dashboard", { replace: true });
        return;
      }

      navigate("/doctor/login", { replace: true });
    } catch (registrationError) {
      console.error("Doctor registration error:", registrationError);
      setError(registrationError.message || "Could not create the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Create a doctor account</h1>

      <p className="subtitle">
        You will be signed in straight away and taken to the review queue.
      </p>

      <form onSubmit={registerDoctor} className="patient-form">

        <input
          type="text"
          name="name"
          placeholder="Full name"
          value={form.name}
          onChange={handleChange}
          required
        />

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
          placeholder="Password (at least 6 characters)"
          value={form.password}
          onChange={handleChange}
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>

        {error && <p className="error">{error}</p>}

      </form>

      <div className="form-links">
        <Link className="back-button" to="/doctor/login">
          ← Back to doctor sign in
        </Link>
      </div>

    </div>
  );
}

export default DoctorRegistration;
