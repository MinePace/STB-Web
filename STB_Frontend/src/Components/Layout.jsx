import React from "react";
import Sidebar from "./Sidebar";
import "./Layout.css"; // Zorg dat je een aparte CSS hebt voor de Layout

function Layout({ children, showSidebar }) {
  return (
    <div className="layout-container">
      {showSidebar && <Sidebar />} {/* Sidebar alleen weergeven als showSidebar true is */}
      <div className={`content-container ${showSidebar ? "with-sidebar" : ""}`}>
        {children} {/* Hier komt de content van elke pagina */}
      </div>
    </div>
  );
}

export default Layout;
