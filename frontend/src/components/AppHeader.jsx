/**
 * The bar that sits on every screen except the landing page.
 *
 * It exists because the app had no way back: each page carried its own
 * ad-hoc "Back" button, there was no route home, and signing out was only
 * reachable from a dashboard.
 */
function AppHeader({ role, onHome, onDashboard, onLogout }) {
  return (
    <header className="app-header">

      <button
        className="app-brand"
        onClick={onHome}
        title="Home"
      >
        <span className="app-brand-mark">◎</span>
        Retinal Screening
      </button>

      <span className="app-header-spacer" />

      {role && (
        <span className="app-role">
          {role === "DOCTOR" ? "Doctor" : "Patient"}
        </span>
      )}

      <nav>
        <button className="nav-button" onClick={onHome}>
          Home
        </button>

        {onDashboard && (
          <button className="nav-button" onClick={onDashboard}>
            Dashboard
          </button>
        )}

        {onLogout && (
          <button
            className="nav-button is-danger"
            onClick={onLogout}
          >
            Sign out
          </button>
        )}
      </nav>

    </header>
  );
}

export default AppHeader;
