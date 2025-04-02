import React from "react";
import { Link } from "react-router-dom";
import "./Sidebar.css"; // Zorg dat je een aparte CSS hebt voor de Sidebar

function Sidebar() {
  const seasons = [
    { year: 28, divisions: ["1", "2", "3"] },
    { year: 25, divisions: ["1", "2", "3"] },
    { year: 24, divisions: ["1", "2", "3"] },
    { year: 23, divisions: ["1", "2"] },
    { year: 22, divisions: ["1", "2", "3"] },
    { year: 21, divisions: ["1", "2"] },
    { year: 20, divisions: ["1"] },
    { year: 9, divisions: ["1", "2"] },
    { year: 8, divisions: ["1", "2"] },
  ]; // Seizoenen en hun divisies

  return (
    <div className="sidebar">
      <ul>
        {seasons.map((season) => (
          <li key={season.year} className="season-item">
            <span className="season-label">Season {season.year}</span>
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
  );
}

export default Sidebar;
