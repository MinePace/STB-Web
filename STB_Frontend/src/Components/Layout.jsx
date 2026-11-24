import React from "react";
import { useTranslation } from "react-i18next";
import Topbar from "./Topbar";
import "./Layout.css";

// The old sidebar (seasons/divisions) now lives in the "Championship" menu of the Topbar.
// `showSidebar` is still accepted so existing routes keep working.
// eslint-disable-next-line no-unused-vars
function Layout({ children, showSidebar }) {
  const { t } = useTranslation();
  return (
    <div className="layout-container">
      <Topbar />
      <main id="main" className="content-container">
        <div className="content-inner">{children}</div>
        <footer className="site-footer">
          <img src="/STB3.png" alt="" aria-hidden className="site-footer__logo" loading="lazy" />
          <span>STB League · {t("footer.tagline")}</span>
        </footer>
      </main>
    </div>
  );
}

export default Layout;
