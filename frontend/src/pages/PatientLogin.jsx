import { useState } from "react";

function PatientLogin({
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

  const loginPatient = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      // -----------------------------------------------------
      // 1. Authenticate user
      // -----------------------------------------------------

      const loginResponse = await fetch(
        "http://localhost:8080/api/auth/login",
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

      const loginText = await loginResponse.text();

      if (!loginResponse.ok) {
        throw new Error(
          loginText || "Login failed."
        );
      }

      const user = JSON.parse(loginText);

      if (user.role !== "PATIENT") {
        throw new Error(
          "This account is not registered as a patient."
        );
      }

      // -----------------------------------------------------
      // 2. Get patient profile using user ID
      // -----------------------------------------------------

      const patientResponse = await fetch(
        `http://localhost:8080/api/patients/user/${user.id}`
      );

      const patientText =
        await patientResponse.text();

      if (!patientResponse.ok) {
        throw new Error(
          patientText ||
          "Patient profile not found."
        );
      }

      const patient =
        JSON.parse(patientText);

      // -----------------------------------------------------
      // 3. Open patient dashboard
      // -----------------------------------------------------

      onLoginSuccess(patient);

    } catch (error) {
      console.error(
        "Patient login error:",
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

      <h1>Patient Login</h1>

      <p className="subtitle">
        Login to access your screening dashboard.
      </p>

      <form
        onSubmit={loginPatient}
        className="patient-form"
      >

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

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Logging in..."
            : "Login"}
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
        Register as Patient
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

export default PatientLogin;