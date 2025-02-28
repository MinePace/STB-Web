import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./EditRaceResultPage.css";

function EditRaceResults() {
  const { season: paramSeason, round: paramRound, division, type } = useParams();
  const navigate = useNavigate();
  
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(paramSeason || "");
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(paramRound || "");
  const [raceResults, setRaceResults] = useState([]);
  const [editedResults, setEditedResults] = useState({});

  useEffect(() => {
      const role = localStorage.getItem("role");
      if (role !== "Admin") {
        navigate("/"); // Stuur terug naar homepage als geen admin
      }
    }, [navigate]);

  useEffect(() => {
    fetch(`http://localhost:5110/api/race/seasons`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSeasons(data);
        } else {
          console.error("Seasons API did not return an array", data);
          setSeasons([]);
        }
      })
      .catch((err) => console.error("Error fetching seasons:", err));
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetch(`http://localhost:5110/api/race/races/${selectedSeason}`)
        .then((res) => res.json())
        .then((data) => setRaces(data))
        .catch((err) => console.error("Error fetching races:", err));
    } else {
      setRaces([]);
      setSelectedRace("");
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedSeason && selectedRace) {
      fetch(`http://localhost:5110/api/race/results/${selectedRace}`)
        .then((res) => res.json())
        .then((data) => setRaceResults(data))
        .catch((err) => console.error("Error fetching race results:", err));
    } else {
      setRaceResults([]);
    }
  }, [selectedSeason, selectedRace, division, type]);

  const handleInputChange = (id, field, value) => {
    setEditedResults((prev) => {
      const updatedResult = { ...prev[id], [field]: value };
      if (field === "position" || field === "qualifying") {
        updatedResult.pos_Change = (updatedResult.qualifying || 0) - (updatedResult.position || 0);
      }
      return { ...prev, [id]: updatedResult };
    });
  };

  const handleSave = async (id) => {
    const updatedResult = editedResults[id];
    if (!updatedResult) return;

    const response = await fetch(`http://localhost:5110/api/race/result/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedResult),
    });

    if (response.ok) {
      alert("Race result updated successfully!");
      navigate(-1);
    } else {
      alert("Failed to update result.");
    }
  };

  return (
    <div className="edit-race-results-container">
      <h1>Edit Race Results</h1>

      {/* Season Selection */}
      <div>
        <label>Select Season: </label>
        <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
          <option value="">-- Select Season --</option>
          {seasons.length > 0 ? (
            seasons.map((s) => (
              <option key={s} value={s}>
                Season {s}
              </option>
            ))
          ) : (
            <option disabled>No seasons available</option>
          )}
        </select>
      </div>

      {/* Race Selection */}
      {selectedSeason && (
        <div>
          <label>Select Race: </label>
          <select value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)}>
            <option value="">-- Select Race --</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Race Results Table */}
      {selectedSeason && selectedRace && (
        <>
          <h2>Race Results - {type} {selectedRace} - Season {selectedSeason}</h2>
          <table className="race-results-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Driver</th>
                <th>Team</th>
                <th>Pts</th>
                <th>DNF</th>
                <th>Quali</th>
                <th>Pos Δ</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {raceResults.map((result) => (
                <tr key={result.id}>
                  <td>
                    <input
                      type="number"
                      className="compact-input"
                      value={editedResults[result.id]?.position || result.position}
                      onChange={(e) => handleInputChange(result.id, "position", parseInt(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="compact-input"
                      value={editedResults[result.id]?.driver || result.driver}
                      onChange={(e) => handleInputChange(result.id, "driver", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="compact-input"
                      value={editedResults[result.id]?.team || result.team}
                      onChange={(e) => handleInputChange(result.id, "team", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="compact-input"
                      value={editedResults[result.id]?.points || result.points}
                      onChange={(e) => handleInputChange(result.id, "points", parseInt(e.target.value))}
                    />
                  </td>
                  <td>
                    <select
                      className="compact-select"
                      value={editedResults[result.id]?.dnf || result.dnf}
                      onChange={(e) => handleInputChange(result.id, "dnf", e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="compact-input"
                      value={editedResults[result.id]?.qualifying || result.qualifying}
                      onChange={(e) => handleInputChange(result.id, "qualifying", parseInt(e.target.value))}
                    />
                  </td>
                  <td>{editedResults[result.id]?.pos_Change ?? result.pos_Change}</td>
                  <td>
                    <button className="save-btn" onClick={() => handleSave(result.id)}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="cancel-btn" onClick={() => navigate(-1)}>Cancel</button>
        </>
      )}
    </div>
  );
}

export default EditRaceResults;
