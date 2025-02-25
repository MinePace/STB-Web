import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Topbar.css";

function Topbar() {
  const isLoggedIn = localStorage.getItem("token") !== null;
  const role = localStorage.getItem("role") || "user";
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    alert("Logged out");
    navigate("/login");
  };

  return (
    <div className="topbar">
      <div className="logo-container">
        <Link to="/">
          <img src="/STB.png" alt="Championship Logo" className="logo" />
        </Link>
      </div>
      <div className="nav-container">
        <ul className="nav-links">
          <li>
            <Link to="/" className="nav-link">Home</Link>
          </li>
          {role === "Admin" && (
            <li>
              <Link to="/admin" className="nav-link">Admin Hub</Link>
            </li>
          )}
          {!isLoggedIn && (
            <li>
              <Link to="/login" className="nav-link">Login</Link>
            </li>
          )}
          {isLoggedIn && (
            <li>
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Topbar;
