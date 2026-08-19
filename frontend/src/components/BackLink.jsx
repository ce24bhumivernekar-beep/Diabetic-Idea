import { Link } from "react-router-dom";

/**
 * One back control for the whole app.
 *
 * It takes an explicit destination on purpose. navigate(-1) walks a visitor
 * who arrived from a bookmark or a shared link straight out of the app, which
 * is the same complaint that started this work - the browser's own Back button
 * already handles history.
 */
function BackLink({ to, label = "Back" }) {
  return (
    <Link className="back-button back-link" to={to}>
      ← {label}
    </Link>
  );
}

export default BackLink;
