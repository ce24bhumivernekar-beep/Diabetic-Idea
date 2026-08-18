import { useEffect, useRef, useState } from "react";

import { eventStreamUrl } from "../config";

function parsePayload(data) {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Subscribes to the API event stream and calls onEvent for every named event.
 *
 * If the stream cannot be held open - old browser, proxy that buffers SSE,
 * flaky mobile network - it falls back to polling so the dashboards still
 * refresh on their own.
 *
 * @param {string[]} names   event names to react to
 * @param {Function} onEvent called with (name, payload)
 * @param {number}   pollMs  fallback interval
 * @returns {{live: boolean, lastEventAt: Date|null}}
 */
export function useLiveEvents(names, onEvent, pollMs = 15000) {
  const [live, setLive] = useState(false);
  const [lastEventAt, setLastEventAt] = useState(null);

  // Keep the newest callback without re-subscribing on every render.
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const namesKey = names.join(",");

  useEffect(() => {
    const url = eventStreamUrl();

    if (!url || typeof EventSource === "undefined") {
      return undefined;
    }

    const source = new EventSource(url);
    const eventNames = namesKey.split(",").filter(Boolean);

    let pollTimer = null;

    const startPolling = () => {
      if (pollTimer) {
        return;
      }

      pollTimer = setInterval(() => {
        handlerRef.current("poll", null);
      }, pollMs);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    source.addEventListener("connected", () => {
      setLive(true);
      stopPolling();
    });

    eventNames.forEach((name) => {
      source.addEventListener(name, (message) => {
        setLastEventAt(new Date());
        handlerRef.current(name, parsePayload(message.data));
      });
    });

    source.onerror = () => {
      // The browser retries on its own; poll meanwhile so the view still moves.
      setLive(false);
      startPolling();
    };

    return () => {
      stopPolling();
      source.close();
      setLive(false);
    };
  }, [namesKey, pollMs]);

  return { live, lastEventAt };
}

export default useLiveEvents;
