import { useState } from "react";
import { API_URL, apiError } from "../config";

function PatientRegistration({ onPatientCreated }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    email: "",
    phone: "",
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

  const registerPatient = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      // -----------------------------------------------------
      // 1. Create authentication account
      // -----------------------------------------------------

      const authResponse = await fetch(
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
            role: "PATIENT",
          }),
        }
      );

      const authText = await authResponse.text();

      if (!authResponse.ok) {
        throw new Error(apiError(authText, "Could not create patient account."));
      }

      const user = JSON.parse(authText);

      if (!user.token) {
        throw new Error(
          "Registration succeeded but no authentication token was received."
        );
      }

      // -----------------------------------------------------
      // 2. Save authentication information
      // -----------------------------------------------------

      localStorage.setItem(
        "authToken",
        user.token
      );

      localStorage.setItem(
        "userRole",
        user.role
      );

      localStorage.setItem(
        "userId",
        user.id
      );

      localStorage.setItem(
        "userEmail",
        user.email
      );

      // -----------------------------------------------------
      // 3. Create patient profile
      // -----------------------------------------------------

      const patientResponse = await fetch(
        `${API_URL}/api/patients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            userId: user.id,
            name: form.name.trim(),
            age: Number(form.age),
            gender: form.gender,
            email: form.email.trim(),
            phone: form.phone.trim(),
          }),
        }
      );

      const patientText =
        await patientResponse.text();

      if (!patientResponse.ok) {
        throw new Error(apiError(patientText, "Could not create patient profile."));
      }

      const patient =
        JSON.parse(patientText);

      // -----------------------------------------------------
      // 4. Continue to patient dashboard
      // -----------------------------------------------------

      onPatientCreated(patient);

    } catch (error) {
      console.error(
        "Patient registration error:",
        error
      );

      setError(
        error.message ||
          "Could not register patient."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>Patient Registration</h1>

      <p className="subtitle">
        Create an account before starting a screening.
      </p>

      <form
        onSubmit={registerPatient}
        className="patient-form"
      >

        <input
          type="text"
          name="name"
          placeholder="Patient Name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="age"
          placeholder="Age"
          value={form.age}
          onChange={handleChange}
          min="1"
          max="120"
          required
        />

        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          required
        >
          <option value="">
            Select Gender
          </option>

          <option value="Male">
            Male
          </option>

          <option value="Female">
            Female
          </option>

          <option value="Other">
            Other
          </option>
        </select>

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
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
            : "Register Patient"}
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

export default PatientRegistration;