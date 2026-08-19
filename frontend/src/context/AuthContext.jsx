import { useCallback, useEffect, useMemo, useState } from "react";

import { API_URL, apiError, authHeaders, clearSession } from "../config";
import { AuthContext } from "./auth";

/**
 * Who is signed in, restored once on load.
 *
 * The token was already being written to localStorage before this existed, but
 * nothing read it back, so every refresh threw the user out. Restoring here -
 * above the router - also means a guarded deep link can wait for the answer
 * instead of bouncing to a login page it does not need.
 *
 * status: "restoring" until we know, then "ready".
 */

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("restoring");
  const [role, setRole] = useState(null);
  const [patient, setPatient] = useState(null);
  const [doctor, setDoctor] = useState(null);

  const signOut = useCallback(() => {
    clearSession();
    setRole(null);
    setPatient(null);
    setDoctor(null);
    setStatus("ready");
  }, []);

  /**
   * Called from a page whose request came back 401. Without this the user sits
   * on a guarded page whose every fetch fails, looking like a frozen app.
   */
  const handleUnauthorized = useCallback(() => {
    signOut();
  }, [signOut]);

  const signInPatient = useCallback((profile) => {
    setPatient(profile);
    setDoctor(null);
    setRole("PATIENT");
    setStatus("ready");
  }, []);

  const signInDoctor = useCallback((account) => {
    setDoctor(account);
    setPatient(null);
    setRole("DOCTOR");
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const token = localStorage.getItem("authToken");
      const storedRole = localStorage.getItem("userRole");
      const userId = localStorage.getItem("userId");
      const email = localStorage.getItem("userEmail");

      if (!token || !storedRole) {
        if (!cancelled) {
          setStatus("ready");
        }
        return;
      }

      try {
        if (storedRole === "DOCTOR") {
          // Verify the token against the server. Trusting localStorage alone
          // produced a "signed in" app whose every request then 403'd.
          const response = await fetch(
            `${API_URL}/api/auth/user/${encodeURIComponent(email)}`,
            { headers: authHeaders() }
          );

          const text = await response.text();

          if (!response.ok) {
            throw new Error(apiError(text, "Session expired."));
          }

          if (!cancelled) {
            setDoctor(JSON.parse(text));
            setRole("DOCTOR");
          }
        } else {
          const response = await fetch(
            `${API_URL}/api/patients/user/${userId}`,
            { headers: authHeaders() }
          );

          const text = await response.text();

          if (!response.ok) {
            throw new Error(apiError(text, "Session expired."));
          }

          if (!cancelled) {
            setPatient(JSON.parse(text));
            setRole("PATIENT");
          }
        }
      } catch (error) {
        console.error("Session restore failed:", error);
        clearSession();
      } finally {
        if (!cancelled) {
          setStatus("ready");
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      role,
      patient,
      doctor,
      signInPatient,
      signInDoctor,
      signOut,
      handleUnauthorized,
      setPatient,
    }),
    [
      status,
      role,
      patient,
      doctor,
      signInPatient,
      signInDoctor,
      signOut,
      handleUnauthorized,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
