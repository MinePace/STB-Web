import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

function AdminHub() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") {
      navigate("/"); // Stuur terug naar homepage als geen admin
    }
  }, [navigate]);

  return (
    <div className="admin-container">
      <h1>Admin Hub</h1>
      <p>Welcome to the Admin Hub. Please select an action below:</p>

      {/* Links naar specifieke pagina's */}
      <div className="admin-links">
        <ul>
          <li>
            <Link to="/STB/Add/Race">Add a New Race</Link>
          </li>
          <li>
            <Link to="/STB/Add/Track">Add a New Track</Link>
          </li>
          <li>
            <Link to="/STB/Add/RaceResults">Add a Race Results</Link>
          </li>
          <li>
            <Link to="/STB/Edit/Race">Edit Existing Races</Link>
          </li>
          <li>
            <Link to="/STB/Edit/RaceResults">Edit Race Results</Link>
          </li>
          <li>
            <Link to="/STB/Edit/Tracks">Edit Exiting Tracks</Link>
          </li>
          <li>
            <Link to="/STB/Add/CSV">Add a Race with .CSV</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default AdminHub;
