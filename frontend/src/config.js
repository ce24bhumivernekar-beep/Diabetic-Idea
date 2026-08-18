/**
 * Single place where the frontend learns about the rest of the pipeline.
 *
 *   React (5173)  ->  Spring Boot API (8080)  ->  FastAPI AI service (8000)
 *
 * The AI service is contacted directly only for the generated images
 * (original / heatmap / overlay); every data call goes through the API.
 *
 * Both are same-origin by default and reach their service through the dev
 * server proxy (see vite.config.js), so a phone needs no configuration at all.
 * Point them elsewhere only when the services are not behind this origin:
 *   VITE_API_URL=http://192.168.0.101:8080
 *   VITE_AI_URL=http://192.168.0.101:8000
 */

/**
 * Empty string means "same origin": the dev server proxies /api to the Spring
 * Boot API and /generated to the AI service. Keeping every request on one
 * origin is what lets a phone use the app over a single HTTPS tunnel without
 * mixed-content errors.
 */
export const API_URL = import.meta.env.VITE_API_URL || "";

export const AI_URL = import.meta.env.VITE_AI_URL || "";

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
