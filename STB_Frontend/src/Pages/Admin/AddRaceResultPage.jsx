import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Points Table for Main and Sprint Races
const MAIN_RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SPRINT_RACE_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function AddRaceResults() {
  const [races, setRaces] = useState([]);
  const [filteredRaces, setFilteredRaces] = useState([]);
  const [existingResults, setExistingResults] = useState(new Set());
  const [selectedRace, setSelectedRace] = useState(null);
  const [raceResults, setRaceResults] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const navigate = useNavigate();

  const driverInputRef = useRef(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") {
      navigate("/"); // Redirect if not admin
    }
  }, [navigate]);

  // Fetch races and existing results
  useEffect(() => {
    fetch("http://localhost:5110/api/race/races")
      .then((res) => res.json())
      .then((data) => {
        setRaces(data);
        fetchExistingResults(data); // Fetch existing results after fetching races
      })
      .catch((err) => console.error("Error fetching races:", err));
  }, []);

  const fetchExistingResults = (allRaces) => {
    fetch("http://localhost:5110/api/race/raceresults")
      .then((res) => res.json())
      .then((data) => {
        const raceIdsWithResults = new Set(data.map((result) => result.raceId));
        setExistingResults(raceIdsWithResults);

        const availableRaces = allRaces.filter((race) => !raceIdsWithResults.has(race.id));
        setFilteredRaces(availableRaces);
      })
      .catch((err) => console.error("Error fetching existing results:", err));
  };

  useEffect(() => {
    if (selectedRace) {
      fetch(`http://localhost:5110/api/driver/season/${selectedRace.season}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setDriversList(data);
          }
        })
        .catch((err) => console.error("Error fetching drivers:", err));
    }
  }, [selectedRace]);

  const handleRaceSelect = (e) => {
    const raceId = e.target.value;
    const race = filteredRaces.find((race) => race.id.toString() === raceId);

    if (!race) {
      console.error("Selected race not found!");
      return;
    }

    setSelectedRace(race);
    const pointsTable = race.sprint === "Yes" ? SPRINT_RACE_POINTS : MAIN_RACE_POINTS;

    setRaceResults(
      Array.from({ length: 20 }, (_, index) => ({
        position: index + 1,
        driver: "",
        team: "",
        points: pointsTable[index] || 0,
        dnf: "No",
        pos_Change: 0,
        qualifying: "",
        fastestLap: false,
        raceTime: "",
      }))
    );
  };

  const handleResultChange = (index, field, value) => {
    setRaceResults((prevResults) => {
      const updatedResults = [...prevResults];

      updatedResults[index] = { ...updatedResults[index], [field]: value };

      if (field === "position" || field === "qualifying") {
        const q = parseInt(updatedResults[index].qualifying, 10);
        updatedResults[index].pos_Change =
          Number.isFinite(q) && updatedResults[index].position
            ? q - updatedResults[index].position
            : 0;
      }

      if (field === "dnf" && value === "Yes") {
        for (let i = index; i < updatedResults.length; i++) {
          updatedResults[i].dnf = "Yes";
        }
      }

      if (field === "fastestLap") {
        updatedResults.forEach((row, i) => {
          if (i !== index) row.fastestLap = false;
        });

        updatedResults.forEach((row, i) => {
          row.points = selectedRace?.sprint === "Yes" ? SPRINT_RACE_POINTS[i] || 0 : MAIN_RACE_POINTS[i] || 0;
          if (row.fastestLap === true && row.position <= 10 && selectedRace?.sprint !== "Yes") {
            row.points += 1;
          }
        });
      }

      return updatedResults;
    });
  };

  const handleSubmit = async () => {
    if (!selectedRace) {
      console.error("No race selected!");
      return;
    }

    const raceData = raceResults.map((result) => ({
      raceId: selectedRace.id,
      position: result.position,
      driver: result.driver.trim(),
      team: result.team.trim(),
      points: result.points,
      dnf: result.dnf,
      qualifying: result.qualifying ? parseInt(result.qualifying, 10) : 0,
      pos_Change: result.pos_Change,
      fastestLap: result.fastestLap,
      Time: result.raceTime.trim(),
    }));

    try {
      const response = await fetch("http://localhost:5110/api/race/raceresults", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(raceData),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      alert(`${data.message}`);
    } catch (error) {
      console.error("❌ Error submitting results:", error);
      alert("Error submitting results! Check the console for details.");
    }
  };

  // Handle Tab key press to move down between inputs
  const handleTabKeyDown = (e, index, type) => {
    if (e.key === "Tab") {
      e.preventDefault();

      const isShiftPressed = e.shiftKey;
      const inputClass = `${type}-input`;
      const inputs = Array.from(document.querySelectorAll(`.${inputClass}`));

      let nextIndex;

      if (isShiftPressed) {
        nextIndex = index === 0 ? inputs.length - 1 : index - 1;
      } else {
        nextIndex = (index + 1) % inputs.length;
      }

      inputs[nextIndex].focus();
    }
  };

  // NEW: Paste handler to fill down a column from the focused row
  const handleColumnPaste = (e, startIndex, field) => {
    const text = e.clipboardData?.getData("text");
    if (!text) return;

    // Split into non-empty lines
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // If it’s just a single line, let the native paste happen (so single-cell paste works).
    if (lines.length <= 1) return;

    // We’re handling it — stop the default paste
    e.preventDefault();

    setRaceResults((prev) => {
      const updated = [...prev];

      const toBool = (raw) => {
        const v = String(raw).toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "y";
      };
      const toYesNo = (raw) => (toBool(raw) ? "Yes" : "No");

      for (let i = 0; i < lines.length; i++) {
        const idx = startIndex + i;
        if (idx >= updated.length) break;

        // Take the first token on the line (so tab/comma-separated still works)
        const firstCell = lines[i].split(/\t|,/)[0]?.trim() ?? "";

        let value = firstCell;
        if (field === "qualifying") {
          const n = parseInt(firstCell, 10);
          value = Number.isFinite(n) ? n : "";
        } else if (field === "dnf") {
          value = toYesNo(firstCell);
        } else if (field === "fastestLap") {
          value = toBool(firstCell);
        }

        const row = { ...updated[idx], [field]: value };

        // Keep Position Change in sync when qualifying changes
        if (field === "qualifying") {
          const q = parseInt(row.qualifying, 10);
          row.pos_Change = Number.isFinite(q) ? q - row.position : 0;
        }

        updated[idx] = row;
      }

      return updated;
    });
  };

  return (
    <div className="add-race-results-container">
      <h1>Add Race Results</h1>

      {/* Race Selection */}
      <div className="race-settings">
        <h2>Select Race</h2>
        <select onChange={handleRaceSelect} required>
          <option value="">Select a Race</option>
          {filteredRaces.length > 0 ? (
            filteredRaces.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name} - Season {race.season}, Round {race.round}, Div {race.division}{" "}
                {race.sprint === "Yes" ? "(Sprint)" : ""}
              </option>
            ))
          ) : (
            <option disabled>No races available</option>
          )}
        </select>
      </div>

      {/* Results Form */}
      <div className="result-form">
        <h2>Add Results for {selectedRace?.track?.raceName}</h2>
        <p style={{ fontSize: 12, color: "#444951ff" }}>
          Tip: You can paste multiple rows from Excel/Sheets. Focus a cell in Driver, Team, Qualifying or Race Time,
          then paste — it fills down from the focused row.
        </p>
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Points</th>
              <th>DNF</th>
              <th>Qualifying</th>
              <th>Position Change</th>
              <th>Fastest Lap</th>
              <th>Race Time</th>
            </tr>
          </thead>
          <tbody>
            {raceResults.map((result, index) => (
              <tr key={index}>
                <td>{result.position}</td>
                <td>
                  <input
                    type="text"
                    list="drivers-list"
                    value={result.driver}
                    onChange={(e) => handleResultChange(index, "driver", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, index, "driver")}
                    onPaste={(e) => handleColumnPaste(e, index, "driver")} // NEW
                    placeholder="Select or type driver..."
                    className="driver-input"
                  />
                  <datalist id="drivers-list">
                    {driversList.map((driver, i) => (
                      <option key={i} value={driver} />
                    ))}
                  </datalist>
                </td>
                <td>
                  <input
                    type="text"
                    value={result.team}
                    onChange={(e) => handleResultChange(index, "team", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, index, "team")}
                    onPaste={(e) => handleColumnPaste(e, index, "team")} // NEW
                    className="team-input"
                  />
                </td>
                <td>{result.points}</td>
                <td>
                  <select
                    value={result.dnf}
                    onChange={(e) => handleResultChange(index, "dnf", e.target.value)}
                    // Note: native select doesn't have a paste UX, so we skip onPaste here.
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={result.qualifying}
                    onChange={(e) => handleResultChange(index, "qualifying", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, index, "quali")}
                    onPaste={(e) => handleColumnPaste(e, index, "qualifying")} // NEW
                    className="quali-input"
                  />
                </td>
                <td>{result.pos_Change}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={result.fastestLap}
                    onChange={(e) => handleResultChange(index, "fastestLap", e.target.checked)}
                    // If you want to support pasting booleans here, you could add:
                    // onPaste={(e) => handleColumnPaste(e, index, "fastestLap")}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={result.raceTime}
                    onChange={(e) => handleResultChange(index, "raceTime", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, index, "time")}
                    onPaste={(e) => handleColumnPaste(e, index, "raceTime")} // NEW
                    placeholder="Enter race time"
                    className="time-input"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
      <button onClick={handleSubmit} disabled={!selectedRace}>
        Submit All Results
      </button>
    </div>
  );
}

export default AddRaceResults;
