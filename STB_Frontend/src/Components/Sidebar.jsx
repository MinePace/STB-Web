import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Sidebar.css";
import "@/Components/Links.css";

function Sidebar() {
  const seasons = [
    { year: 31, divisions: ["1", "2", "3", "4", "5"]},
    { year: 30, divisions: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    { year: 29, divisions: ["1", "2", "3", "4"] },
    { year: 28, divisions: ["1", "2", "3"] },
    { year: 27, divisions: ["1", "2", "3"] },
    { year: 26, divisions: ["1", "2", "3"] },
    { year: 25, divisions: ["1", "2", "3"] },
    { year: 24, divisions: ["1", "2", "3"] },
    { year: 23, divisions: ["1", "2", "3"] },
    { year: 22, divisions: ["1", "2", "3"] },
    { year: 21, divisions: ["1", "2", "3"] },
    { year: 20, divisions: [] },
    { year: 19, divisions: [] },
    { year: 18, divisions: [] },
    { year: 17, divisions: [] },
    { year: 16, divisions: [] },
    { year: 15, divisions: ["1"] },
    { year: 14, divisions: [] },  
    { year: 13, divisions: [] },
    { year: 12, divisions: [] },
    { year: 11, divisions: [] },
    { year: 10, divisions: [] },
    { year: 9, divisions: [] },
    { year: 8, divisions: ["1"] },
  ];

  const [seasonRaced, setSeasonRaced] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [roleState, setRoleState] = useState("user");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);

      setRoleState(decoded.role);
      setUsername(decoded.username);
    } catch (e) {
      console.log("JWT decode failed:", e);
    }
  }, []);

  useEffect(() => {
    if (!username) return; // wait until username exists

    const fetchSeasonRaced = async () => {
      try {
        const res = await fetch(
          `https://stbleaguedata.vercel.app/api/driver/claimeddriver/races/${username}`
        );

        if (!res.ok) throw new Error("Failed to fetch driver stats");

        const data = await res.json();
        setSeasonRaced(data);
      } catch (err) {
        console.error(err);
        setError("Could not load driver stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonRaced();
  }, [username]);

  // Normalize races into Map<season, Set<divisions>>
  const racedBySeason = useMemo(() => {
    const map = new Map();
    for (const { season, division } of seasonRaced) {
      if (!map.has(season)) map.set(season, new Set());
      if (division !== null && division !== undefined) {
        map.get(season).add(String(division));
      }
    }
    return map;
  }, [seasonRaced]);

  const didRaceSeason = (year) => racedBySeason.has(year);
  const didRaceDivision = (year, division) =>
    racedBySeason.has(year) && racedBySeason.get(year).has(String(division));

  if (loading) return <div className="sidebar">Loading…</div>;

  return (
    <div className="sidebar">
      <ul>
        {seasons.map((season) => {
          const seasonRaced = didRaceSeason(season.year);
          if (season.divisions.length === 0) {
            return null;
          }

          return (
            <li
              key={season.year}
              className={`season-item ${seasonRaced ? "season-item--raced" : ""}`}
            >
              <span className="season-label">Season {season.year}</span>
              <ul className="division-dropdown">
                {season.divisions.map((division) => {
                  const raced = didRaceDivision(season.year, division);
                  return (
                    <li key={division}>
                      <Link
                        to={`/STB/Championship/${season.year}/${division}`}
                        className={`division-link ${raced ? "division-link--raced" : ""}`}
                      >
                        Division {division}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Sidebar;
