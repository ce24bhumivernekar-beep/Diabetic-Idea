import { useCallback, useEffect, useState } from "react";

import { API_URL, apiError, authHeaders } from "../config";
import { useAuth } from "../context/auth";

/**
 * One screening, loaded from the id in the URL.
 *
 * This is what makes a result page survive a refresh and work as a shared
 * link; previously the record arrived as a prop and vanished on reload.
 *
 * There is no GET /api/screenings/{id} for patients - only the list - so the
 * patient branch fetches the list and selects. That is also the right
 * authorisation answer: an id that is not in your list is simply not found.
 */
export function useScreening(id) {
  const { role, patient, handleUnauthorized } = useAuth();

  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const url =
          role === "DOCTOR"
            ? `${API_URL}/api/doctor/screening/${id}`
            : `${API_URL}/api/screenings/patient/${patient?.id}`;

        const response = await fetch(url, { headers: authHeaders() });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const text = await response.text();

        if (!response.ok) {
          throw new Error(apiError(text, "Could not load the screening."));
        }

        const body = JSON.parse(text);

        const found = Array.isArray(body)
          ? body.find((item) => item.id === id)
          : body;

        if (!found) {
          throw new Error("That screening was not found in your history.");
        }

        if (!cancelled) {
          setScreening(found);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Could not load the screening.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (id && (role === "DOCTOR" || patient?.id)) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [id, role, patient?.id, reloadToken, handleUnauthorized]);

  return { screening, loading, error, reload, setScreening };
}

export default useScreening;
