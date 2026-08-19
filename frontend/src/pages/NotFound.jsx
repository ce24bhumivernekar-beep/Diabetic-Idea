import { Link } from "react-router-dom";

import { homeFor, useAuth } from "../context/auth";

function NotFound() {
  const { role } = useAuth();

  return (
    <div className="container">

      <h1>Page not found</h1>

      <p className="subtitle">
        That address does not match anything in the app.
      </p>

      <div className="dashboard-actions">
        <Link className="nav-button" to="/">
          Go home
        </Link>

        {role && (
          <Link className="nav-button" to={homeFor(role)}>
            My dashboard
          </Link>
        )}
      </div>

    </div>
  );
}

export default NotFound;
