import { useState } from "react";
import { API_URL, apiError } from "../config";

function DoctorLogin({
  onLoginSuccess,
  onRegister,
  onBack,
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const loginDoctor = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
          }),
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(apiError(responseText, "Login failed."));
      }

      const doctor = JSON.parse(responseText);

      if (doctor.role !== "DOCTOR") {
        throw new Error(
          "This account is not registered as a doctor."
        );
      }

      if (!doctor.token) {
        throw new Error(
          "Login succeeded but no authentication token was received."
        );
      }

      localStorage.setItem(
        "authToken",
        doctor.token
      );

      localStorage.setItem(
        "userRole",
        doctor.role
      );

      localStorage.setItem(
        "userId",
        doctor.id
      );

      localStorage.setItem(
        "userEmail",
        doctor.email
      );

      onLoginSuccess(doctor);

    } catch (error) {
      console.error(
        "Doctor login error:",
        error
      );

      setError(
        error.message ||
        "Could not login."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Doctor sign in</h1>

      <p className="subtitle">
        Sign in to review patient screenings.
      </p>

      <form
        onSubmit={loginDoctor}
        className="patient-form"
      >

        <input
          type="email"
          name="email"
          placeholder="Doctor Email"
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

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Signing in..."
            : "Sign in"}
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </form>

      <button
        className="back-button"
        onClick={onRegister}
      >
        Create a doctor account
      </button>

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back
      </button>

    </div>
  );
}

export default DoctorLogin;