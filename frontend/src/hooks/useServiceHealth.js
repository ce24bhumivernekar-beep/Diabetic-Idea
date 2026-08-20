import { useCallback, useEffect, useRef, useState } from "react";

import { API_URL } from "../config";

/**
 * Watches whether the AI service is actually awake.
 *
 * The screening page used to check once when it loaded and never again. On
 * free hosting the AI container sleeps after about fifteen minutes, so the
 * check would find it down, print "still waking up", and then leave that
 * warning on screen forever - including long after the service was ready. The
 * user is told the tool is broken while it works, or that it works while it is
 * asleep. Either way the message is wrong.
 *
 * So this keeps asking until it is up, and reports how long it has been
 * waiting, because "waking up, 20 seconds so far" is a fundamentally different
 * message from "broken".
 */

const POLL_MS = 4000;

// Past this, waiting is no longer the explanation.
const GIVE_UP_MS = 120000;

function useServiceHealth() {
  const [health, setHealth] = useState(null);
  const [waitedMs, setWaitedMs] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  // Stamped in an effect, not during render: reading the clock while
  // rendering is a side effect, and React may render more than once.
  const startedAt = useRef(0);
  const timer = useRef(null);
  const cancelled = useRef(false);

  const check = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const body = await response.json();

      if (cancelled.current) {
        return body;
      }

      setHealth(body);

      return body;
    } catch {
      // The backend itself may be cold. Not reaching it is indistinguishable
      // from it being down, and both are answered by waiting.
      if (!cancelled.current) {
        setHealth({ backend: "DOWN", aiService: "DOWN" });
      }

      return null;
    }
  }, []);

  const retry = useCallback(() => {
    startedAt.current = Date.now();
    setWaitedMs(0);
    setGaveUp(false);
    check();
  }, [check]);

  useEffect(() => {
    cancelled.current = false;
    startedAt.current = Date.now();

    const tick = async () => {
      const body = await check();

      if (cancelled.current) {
        return;
      }

      const waited = Date.now() - startedAt.current;
      setWaitedMs(waited);

      if (body && body.aiService === "UP") {
        return;
      }

      if (waited >= GIVE_UP_MS) {
        setGaveUp(true);
        return;
      }

      timer.current = setTimeout(tick, POLL_MS);
    };

    tick();

    return () => {
      cancelled.current = true;

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [check]);

  const ready = Boolean(health && health.aiService === "UP");

  return {
    health,
    ready,
    // Only "waking" once we have actually seen it down - not while the very
    // first request is still in flight, which would flash a warning on a
    // perfectly healthy page.
    waking: Boolean(health) && !ready && !gaveUp,
    gaveUp,
    secondsWaited: Math.round(waitedMs / 1000),
    retry,
  };
}

export default useServiceHealth;
