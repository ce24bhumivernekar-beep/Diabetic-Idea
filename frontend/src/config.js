/**
 * Single place where the frontend learns about the rest of the pipeline.
 *
 *   React (5173)  ->  Spring Boot API (8080)  ->  FastAPI AI service (8000)
 *
 * The AI service is contacted directly only for the generated images
 * (original / heatmap / overlay); every data call goes through the API.
 *
 * Hosts are derived from whatever host the page itself was opened on, so a
 * phone hitting http://192.168.1.20:5173 talks to http://192.168.1.20:8080
 * instead of its own localhost. Override per environment with frontend/.env:
 *   VITE_API_URL=http://localhost:8080
 *   VITE_AI_URL=http://localhost:8000
 */

function serviceUrl(envValue, port) {
  if (envValue) {
    return envValue;
  }

  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;

    return `${protocol}//${hostname}:${port}`;
  }

  return `http://localhost:${port}`;
}

export const API_URL = serviceUrl(import.meta.env.VITE_API_URL, 8080);

export const AI_URL = serviceUrl(import.meta.env.VITE_AI_URL, 8000);

/**
 * The AI service returns a path such as "generated/<id>_overlay.png".
 * Only the file name matters, and the separator differs between
 * Windows and Linux hosts - so split on both.
 */
export function getFileName(path) {
  if (!path) {
    return "";
  }

  return String(path).split(/[\\/]/).pop();
}

export function generatedImageUrl(path) {
  const fileName = getFileName(path);

  if (!fileName) {
    return "";
  }

  return `${AI_URL}/generated/${fileName}`;
}

export function authToken() {
  return localStorage.getItem("authToken");
}

export function authHeaders() {
  const token = authToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * EventSource cannot set an Authorization header, so the live stream takes
 * the token as a query parameter. The API allows that for this route only.
 */
export function eventStreamUrl() {
  const token = authToken();

  if (!token) {
    return "";
  }

  return `${API_URL}/api/events/stream?token=${encodeURIComponent(token)}`;
}

export function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  localStorage.removeItem("userEmail");
}

/**
 * The API reports failures as {"error": "...", "status": 404}.
 * Pull the message out so the user sees the real reason instead of raw JSON.
 */
export function apiError(responseText, fallback) {
  if (!responseText) {
    return fallback;
  }

  try {
    const body = JSON.parse(responseText);

    return body.error || body.message || fallback;
  } catch {
    return responseText;
  }
}
