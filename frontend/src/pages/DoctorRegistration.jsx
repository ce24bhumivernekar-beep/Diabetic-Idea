import { useState } from "react";
import { API_URL, apiError } from "../config";

function DoctorRegistration({ onDoctorRegistered }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const registerDoctor = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: "DOCTOR",
          }),
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(apiError(responseText, "Doctor registration failed."));
      }

      const doctor = JSON.parse(responseText);

      onDoctorRegistered(doctor);

    } catch (error) {
      console.error("Doctor registration error:", error);

      setError(
        error.message ||
        "Could not register doctor."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Doctor Registration</h1>

      <p className="subtitle">
        Create a doctor account to access the screening dashboard.
      </p>

      <form
        onSubmit={registerDoctor}
        className="patient-form"
      >

        <input
          type="text"
          name="name"
          placeholder="Doctor Name"
          value={form.name}
          onChange={handleChange}
          required
        />

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
          minLength={6}
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Registering..."
            : "Register Doctor"}
        </button>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

      </form>

    </div>
  );
}

export default DoctorRegistration;