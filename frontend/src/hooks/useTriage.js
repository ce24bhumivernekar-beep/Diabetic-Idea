import { useEffect, useState } from "react";

import { API_URL, apiError, authHeaders } from "../config";
import { useAuth } from "../context/auth";

/**
 * A patient's camera-health-check assessments.
 *
 * GET /api/triage/patient/{id} existed from the start but nothing ever called
 * it, so an assessment was visible exactly once and lost the moment the user
 * navigated away.
 */
export function useTriageAssessments(patientId) {
  const { handleUnauthorized } = useAuth();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/triage/patient/${patientId}`,
          { headers: authHeaders() }
        );

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const text = await response.text();

        if (!response.ok) {
          throw new Error(apiError(text, "Could not load your health checks."));
        }

        if (!cancelled) {
          setAssessments(JSON.parse(text));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Could not load your health checks.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (patientId) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [patientId, handleUnauthorized]);

  return { assessments, loading, error };
}

export default useTriageAssessments;
