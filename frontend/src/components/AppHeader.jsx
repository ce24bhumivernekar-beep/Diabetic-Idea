import { Link, useLocation, useNavigate } from "react-router-dom";

import { homeFor, useAuth } from "../context/auth";

/**
 * The bar on every screen, landing page included.
 *
 * It exists because the app had no way back: each page carried its own ad-hoc
 * back button, nothing routed home, and signing out was only reachable from a
 * dashboard - so a signed-in user who reached the landing page was stuck.
 */
function AppHeader() {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onAuthPage = /\/(login|register)$/.test(pathname);

  const leave = () => {
    signOut();
    navigate("/", { replace: true });
  };

  return (
    <header className="app-header">

      <Link className="app-brand" to="/" title="Home">
        <span className="app-brand-mark">◎</span>
        RetiNova
      </Link>

      <span className="app-header-spacer" />

      {role && (
        <span className="app-role">
          {role === "DOCTOR" ? "Doctor" : "Patient"}
        </span>
      )}

      <nav>
        <Link
          className={
            pathname === "/" ? "nav-button is-current" : "nav-button"
          }
          to="/"
        >
          Home
        </Link>

        <Link className="nav-button" to="/ai-screening">
          AI info
        </Link>

        <Link className="nav-button" to="/about">
          About
        </Link>

        {role && (
          <Link className="nav-button" to={homeFor(role)}>
            Dashboard
          </Link>
        )}

        {role && (
          <button
            type="button"
            className="nav-button is-danger"
            onClick={leave}
          >
            Sign out
          </button>
        )}

        {/* Hidden on the auth pages themselves: a header "Sign in" next to a
            "Sign in" submit button is two different actions with one name. */}
        {!role && !onAuthPage && (
          <Link className="nav-button" to="/patient/login">
            Sign in
          </Link>
        )}
      </nav>

    </header>
  );
}

export default AppHeader;
