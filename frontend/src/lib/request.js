import { apiError, authHeaders } from "../config";

/**
 * fetch with a deadline and a human explanation.
 *
 * The services sleep after about fifteen minutes of no traffic and take the
 * best part of a minute to wake. Without a timeout the dashboards sat on
 * "Loading..." indefinitely with no error and no retry, which reads as a
 * broken app rather than a waking one.
 */

export const WAKE_MS = 20000;   // past this, say the server is waking
export const GIVE_UP_MS = 75000;

export async function request(url, options = {}, onSlow) {
  const controller = new AbortController();

  const slowTimer = onSlow
    ? setTimeout(() => onSlow(true), WAKE_MS)
    : null;

  const abortTimer = setTimeout(() => controller.abort(), GIVE_UP_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      // 502 here almost always means the AI service is still starting.
      if (response.status === 502 || response.status === 503) {
        throw new Error(
          "The analysis service is still starting up. Give it a minute and try again."
        );
      }

      throw new Error(apiError(text, "That request failed."));
    }

    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "The server did not respond in time. It may be waking from sleep - try again.",
        { cause: error }
      );
    }

    throw error;
  } finally {
    if (slowTimer) {
      clearTimeout(slowTimer);
      onSlow(false);
    }

    clearTimeout(abortTimer);
  }
}

export default request;
