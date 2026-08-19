/**
 * What a slow request looks like. A bare "Loading..." that never resolves is
 * indistinguishable from a crash; this says what is happening and offers a
 * way out.
 */
function LoadingState({ label = "Loading", waking = false, onRetry }) {
  return (
    <div className="state-note">
      <p>
        {waking
          ? "Waking the server - free hosting sleeps after a while, this can take up to a minute..."
          : `${label}...`}
      </p>

      {waking && onRetry && (
        <button type="button" className="back-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export default LoadingState;
