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
      const existingResult = prev[id] || raceResults.find((r) => r.id === id) || {};
  
      const updatedResult = { ...existingResult, [field]: value };
  
      // Ensure both position and qualifying are considered
      const position = updatedResult.position !== undefined ? updatedResult.position : existingResult.position;
      const qualifying = updatedResult.qualifying !== undefined ? updatedResult.qualifying : existingResult.qualifying;
  
      if (position !== undefined && qualifying !== undefined) {
        updatedResult.pos_Change = qualifying - position;
      }
  
      return { ...prev, [id]: updatedResult };
    });
  };  

  const handleSave = async (id) => {
    const updatedResult = editedResults[id];
    if (!updatedResult) return;
  
    // Constructing the RaceResultDTO object
    const raceResultDTO = {
      Driver: updatedResult.driver || raceResults.find(r => r.id === id).driver,
      Team: updatedResult.team || raceResults.find(r => r.id === id).team,
      Points: updatedResult.points || raceResults.find(r => r.id === id).points,
      DNF: updatedResult.dnf || raceResults.find(r => r.id === id).dnf,
      Qualifying: updatedResult.qualifying !== undefined ? updatedResult.qualifying : raceResults.find(r => r.id === id).qualifying,
      Pos_Change: updatedResult.pos_Change !== undefined ? updatedResult.pos_Change : raceResults.find(r => r.id === id).pos_Change
    };
  
    console.log("Sending Data:", raceResultDTO);
  
    const response = await fetch(`http://localhost:5110/api/raceresult/update/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raceResultDTO),
    });
  
    if (response.ok) {
      alert("Race result updated successfully!");
    } else {
      alert("Failed to update result.");
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this result?");
    if (!confirmDelete) return;
  
    const response = await fetch(`http://localhost:5110/api/raceresult/delete/${id}`, {
      method: "DELETE",
    });
  
    if (response.ok) {
      alert("Race result deleted successfully!");
      setRaceResults((prevResults) => prevResults.filter((result) => result.id !== id)); // Remove from UI
    } else {
      alert("Failed to delete result.");
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
                Round: {r.round} - T{r.division}
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
                    <button className="delete-btn" onClick={() => handleDelete(result.id)}>Delete</button>
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
