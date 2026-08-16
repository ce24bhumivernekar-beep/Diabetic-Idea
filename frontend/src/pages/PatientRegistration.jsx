import { useState } from "react";

function PatientRegistration({ onPatientCreated }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    email: "",
    phone: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const response = await fetch(
        "http://localhost:8080/api/patients",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            age: Number(form.age),
            gender: form.gender,
            email: form.email,
            phone: form.phone,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Could not register patient");
      }

      const patient = await response.json();

      onPatientCreated(patient);
    } catch (error) {
      console.error(error);
      setError("Could not register patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Patient Registration</h1>

      <p className="subtitle">
        Enter patient details before starting a screening.
      </p>

      <form onSubmit={registerPatient} className="patient-form">

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
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
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

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register Patient"}
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