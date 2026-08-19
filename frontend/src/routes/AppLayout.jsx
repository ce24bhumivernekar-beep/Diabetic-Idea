import { Outlet, useLocation } from "react-router-dom";

import AppHeader from "../components/AppHeader";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * The shell every page shares.
 *
 * The header lives here rather than in each page, which is what makes Home,
 * Dashboard and Sign out reachable from everywhere - including the landing
 * page, where previously a signed-in user had no way to sign out at all.
 */
function AppLayout() {
  const location = useLocation();

  const onLanding = location.pathname === "/";

  return (
    <div className="app">

      <AppHeader />

      {!onLanding && <Breadcrumbs />}

      <Outlet />

    </div>
  );
}

export default AppLayout;
