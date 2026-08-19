import { Link, useLocation } from "react-router-dom";

/**
 * Where you are, and one click back to everything above you.
 *
 * Driven by a table of path patterns rather than by splitting the URL -
 * splitting gives you "Screenings / 68f3a1c2e4..." which is not a breadcrumb.
 */

const TRAILS = [
  { match: /^\/about$/, trail: [["Home", "/"], ["About", null]] },

  { match: /^\/patient\/login$/, trail: [["Home", "/"], ["Patient sign in", null]] },
  { match: /^\/patient\/register$/, trail: [["Home", "/"], ["Patient sign in", "/patient/login"], ["Create account", null]] },
  { match: /^\/patient\/dashboard$/, trail: [["Home", "/"], ["Dashboard", null]] },
  { match: /^\/patient\/screening$/, trail: [["Home", "/"], ["Dashboard", "/patient/dashboard"], ["Retinal screening", null]] },
  { match: /^\/patient\/screenings\/[^/]+$/, trail: [["Home", "/"], ["Dashboard", "/patient/dashboard"], ["Screening result", null]] },
  { match: /^\/patient\/triage$/, trail: [["Home", "/"], ["Dashboard", "/patient/dashboard"], ["Camera health check", null]] },
  { match: /^\/patient\/triage\/history$/, trail: [["Home", "/"], ["Dashboard", "/patient/dashboard"], ["Health check history", null]] },
  { match: /^\/patient\/triage\/[^/]+$/, trail: [["Home", "/"], ["Dashboard", "/patient/dashboard"], ["Health check result", null]] },

  { match: /^\/doctor\/login$/, trail: [["Home", "/"], ["Doctor sign in", null]] },
  { match: /^\/doctor\/register$/, trail: [["Home", "/"], ["Doctor sign in", "/doctor/login"], ["Create account", null]] },
  { match: /^\/doctor\/dashboard$/, trail: [["Home", "/"], ["Review queue", null]] },
  { match: /^\/doctor\/triage$/, trail: [["Home", "/"], ["Review queue", "/doctor/dashboard"], ["Camera triage queue", null]] },
  { match: /^\/doctor\/screenings\/[^/]+$/, trail: [["Home", "/"], ["Review queue", "/doctor/dashboard"], ["Review", null]] },
];

function Breadcrumbs() {
  const { pathname } = useLocation();

  const entry = TRAILS.find((item) => item.match.test(pathname));

  if (!entry) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {entry.trail.map(([label, to], index) => (
          <li key={label}>
            {to ? (
              <Link to={to}>{label}</Link>
            ) : (
              <span aria-current="page">{label}</span>
            )}

            {index < entry.trail.length - 1 && (
              <span className="breadcrumb-sep" aria-hidden="true">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
