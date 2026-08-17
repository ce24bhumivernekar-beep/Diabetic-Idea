import { useState } from "react";

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
        "http://localhost:8080/api/auth/register",
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
        throw new Error(
          authText || "Could not create patient account."
        );
      }

      // -----------------------------------------------------
      // 2. Create patient profile
      // -----------------------------------------------------

      const patientResponse = await fetch(
        "http://localhost:8080/api/patients",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            age: Number(form.age),
            gender: form.gender,
            email: form.email.trim(),
            phone: form.phone.trim(),
          }),
        }
      );

      const patientText = await patientResponse.text();

      if (!patientResponse.ok) {
        throw new Error(
          patientText || "Could not create patient profile."
        );
      }

      const patient = JSON.parse(patientText);

      // -----------------------------------------------------
      // 3. Continue to patient dashboard
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