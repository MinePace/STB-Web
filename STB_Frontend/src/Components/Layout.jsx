import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar"; // Import the Topbar component
import "./Layout.css"; // Zorg dat je een aparte CSS hebt voor de Layout

function Layout({ children, showSidebar }) {
  return (
    <div className="layout-container">
      <Topbar /> {/* Show the Topbar on every page */}
      <div className="content-wrapper">
        {showSidebar && <Sidebar />} {/* Show Sidebar only if showSidebar is true */}
        <div className={`content-container ${showSidebar ? "with-sidebar" : ""}`}>
          {children} {/* Render the content of each page */}
        </div>
      </div>
    </div>
  );
}

export default Layout;
