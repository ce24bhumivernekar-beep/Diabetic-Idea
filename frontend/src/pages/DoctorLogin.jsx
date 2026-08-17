import { useState } from "react";

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

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          responseText || "Login failed."
        );
      }

      const doctor = JSON.parse(responseText);

      if (doctor.role !== "DOCTOR") {
        throw new Error(
          "This account is not registered as a doctor."
        );
      }

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

      <h1>Doctor Login</h1>

      <p className="subtitle">
        Login to access the doctor screening dashboard.
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
        Register as Doctor
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