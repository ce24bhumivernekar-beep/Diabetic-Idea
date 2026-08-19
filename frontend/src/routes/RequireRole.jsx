import { Navigate, Outlet, useLocation } from "react-router-dom";

import { homeFor, loginFor, useAuth } from "../context/auth";

/**
 * Gate for a whole branch of the route table.
 *
 * While the session is still being restored this renders a splash rather than
 * a redirect - redirecting on "not known yet" is what makes a refresh flash
 * the login page before landing on the right screen.
 */
function RequireRole({ role }) {
  const { status, role: actual } = useAuth();
  const location = useLocation();

  if (status === "restoring") {
    return (
      <div className="container">
        <p className="subtitle">Restoring your session...</p>
      </div>
    );
  }

  if (!actual) {
    // Remember where they were headed so the login can send them back.
    return (
      <Navigate
        to={loginFor(role)}
        state={{ from: location }}
        replace
      />
    );
  }

  if (actual !== role) {
    // Signed in, wrong side of the app. Send them to their own dashboard -
    // asking them to sign in again while holding a valid token is nonsense.
    return <Navigate to={homeFor(actual)} replace />;
  }

  return <Outlet />;
}

export default RequireRole;
