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
    { year: 28, divisions: ["1", "2", "3"]},
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
      
      {/* Hoofdcontent */}
      <div className="main-content">
        <h1>Welcome to the STB Website</h1>
        <p>Hover over a season to select a division.</p>
      </div>
    </div>
  );
}

export default HomePage;
