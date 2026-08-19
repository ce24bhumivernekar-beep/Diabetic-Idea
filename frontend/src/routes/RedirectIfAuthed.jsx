import { Navigate, Outlet } from "react-router-dom";

import { homeFor, useAuth } from "../context/auth";

/**
 * The mirror of RequireRole, for the login and registration pages: someone who
 * is already signed in should not be shown a sign-in form.
 */
function RedirectIfAuthed() {
  const { status, role } = useAuth();

  if (status === "restoring") {
    return (
      <div className="container">
        <p className="subtitle">Restoring your session...</p>
      </div>
    );
  }

  if (role) {
    return <Navigate to={homeFor(role)} replace />;
  }

  return <Outlet />;
}

export default RedirectIfAuthed;
