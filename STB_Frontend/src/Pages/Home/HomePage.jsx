import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("token") !== null);
  const [role, setRole] = useState(localStorage.getItem("role") || "user"); // Haal de rol op
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsLoggedIn(false);
    setRole("user");
    alert("Logged out");
    navigate("/login"); // Stuur de gebruiker terug naar de loginpagina
  };

  const handleAdminHub = () => {
    navigate("/admin"); // Navigeer naar de Admin Hub
  };

  const seasons = [
    { year: 25, divisions: ["1"] },
    { year: 24, divisions: ["1"] },
    { year: 23, divisions: ["1"] },
    { year: 22, divisions: ["1", "2", "3"] },
    { year: 21, divisions: ["1", "2"] },
    { year: 20, divisions: ["1"] },
    { year: 9, divisions: ["1", "2"] },
    { year: 8, divisions: ["1", "2"] },
  ]; // Seizoenen en hun divisies

  return (
    <div className="home-container">
      {/* Topbar met Admin Hub-knop en Logout-knop */}
      <div className="topbar">
        {role === "Admin" && (
          <button onClick={handleAdminHub} className="admin-hub-button">
            Admin Hub
          </button>
        )}
        {isLoggedIn && (
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        )}
      </div>

      {/* Zijbalk */}
      <div className="sidebar">
        <h2>Data</h2>
        <ul>
          {seasons.map((season) => (
            <li key={season.year} className="season-item">
              {/* Hoofdseizoenlink */}
              <span className="season-label">Season {season.year}</span>
              
              {/* Divisies dropdown */}
              <ul className="division-dropdown">
                {season.divisions.map((division) => (
                  <li key={division}>
                    <Link
                      to={`/STB/Championship/${season.year}/${division}`}
                      className="division-link"
                    >
                      Division {division}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {/* Hoofdcontent */}
      <div className="main-content">
        <h1>Welcome to the Championship App</h1>
        <p>Hover over a season to select a division.</p>
      </div>
    </div>
  );
}

export default HomePage;
