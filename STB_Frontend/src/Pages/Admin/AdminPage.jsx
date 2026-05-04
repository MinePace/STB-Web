import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./AdminPage.css";
import "@/Components/Links.css"

function AdminPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Geen token? Meteen terug naar home/login
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const role = decoded.role;

      console.log("Decoded JWT:", decoded);
      console.log("Decoded JWT role:", role);

      if (role !== "Admin") {
        navigate("/");
      }
    } catch (e) {
      console.log("JWT decode failed:", e);
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="admin-container">
      <h1 className="admin-title">Admin Hub</h1>
      <p className="admin-subtitle">
        Manage seasons, tracks and race results
      </p>

      <div className="admin-panel">
        {/* RESULTS */}
        <div className="admin-row">
          <span className="admin-section">RESULTS</span>
          <div className="admin-actions">
            <Link to="/STB/Add/RaceResults" className="primary-link">
              <span className="icon">🏁</span> Add
            </Link>
            <Link to="/STB/Edit/RaceResults" className="primary-link">
              <span className="icon">✏</span> Edit
            </Link>
          </div>
        </div>

        {/* TRACKS */}
        <div className="admin-row">
          <span className="admin-section">TRACKS</span>
          <div className="admin-actions">
            <Link to="/STB/Add/Track" className="primary-link">
              <span className="icon">📍</span> Add
            </Link>
            <Link to="/STB/Edit/Tracks" className="primary-link">
              <span className="icon">✏</span> Edit
            </Link>
          </div>
        </div>

        {/* SEASONS */}
        <div className="admin-row">
          <span className="admin-section">SEASONS</span>
          <div className="admin-actions">
            <Link to="/STB/Add/Season" className="primary-link">
              <span className="icon">📅</span> Add
            </Link>
            <Link to="/STB/Edit/Season" className="primary-link">
              <span className="icon">✏</span> Edit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
