import { Outlet } from "react-router-dom";

import "../print.css";

/**
 * A page meant for paper: no header, no breadcrumb, no navigation. Everything
 * the app normally wraps around a report is exactly what must not appear in a
 * printed document.
 */
function PrintLayout() {
  return (
    <div className="print-page">
      <Outlet />
    </div>
  );
}

export default PrintLayout;
