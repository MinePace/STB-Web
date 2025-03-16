import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CreatableSelect from "react-select/creatable";

// Points Table for Main and Sprint Races
const MAIN_RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SPRINT_RACE_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function AddRaceResults() {
  const [races, setRaces] = useState([]);
  const [filteredRaces, setFilteredRaces] = useState([]); // Filtered list
  const [existingResults, setExistingResults] = useState(new Set()); // Store race IDs that have results
  const [selectedRace, setSelectedRace] = useState(null);
  const [raceResults, setRaceResults] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const navigate = useNavigate();

  const driverInputRef = useRef(null);

  useEffect(() => {
      const role = localStorage.getItem("role");
      if (role !== "Admin") {
        navigate("/"); // Stuur terug naar homepage als geen admin
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

  // Fetch existing race results
  const fetchExistingResults = (allRaces) => {
    fetch("http://localhost:5110/api/race/raceresults")
      .then((res) => res.json())
      .then((data) => {
        const raceIdsWithResults = new Set(data.map((result) => result.raceId)); // Extract race IDs that have results
        setExistingResults(raceIdsWithResults);

        // Filter races that do not have results
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
            setDriversList(data); // Store list of names directly as strings
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
        fastestLap: false, // Default to false
      }))
    );
  };

  const handleResultChange = (index, field, value) => {
    setRaceResults((prevResults) => {
      const updatedResults = [...prevResults];
  
      // ✅ Ensure only the correct row is updated
      updatedResults[index] = { ...updatedResults[index], [field]: value };
  
      // ✅ Update position change calculation
      if (field === "position" || field === "qualifying") {
        updatedResults[index].pos_Change =
          updatedResults[index].qualifying && updatedResults[index].position
            ? updatedResults[index].qualifying - updatedResults[index].position
            : 0;
      }
  
      // ✅ If DNF is set to "Yes", set all remaining rows to DNF
      if (field === "dnf" && value === "Yes") {
        for (let i = index; i < updatedResults.length; i++) {
          updatedResults[i].dnf = "Yes";
        }
      }
  
      // ✅ Ensure only one driver gets Fastest Lap
      if (field === "fastestLap") {
        updatedResults.forEach((row, i) => {
          if (i !== index) row.fastestLap = false; // Uncheck others
        });
  
        // ✅ Recalculate points and only add +1 in non-sprint races
        updatedResults.forEach((row, i) => {
          row.points = selectedRace?.sprint === "Yes" ? SPRINT_RACE_POINTS[i] || 0 : MAIN_RACE_POINTS[i] || 0;
          if (row.fastestLap === true && row.position <= 10 && selectedRace?.sprint !== "Yes") {
            row.points += 1; // ✅ Add fastest lap bonus only for main races
          }
        });
      }
  
      return updatedResults;
    });
  };  

  const handleDriverKeyDown = (e, index) => {
    if (e.key === "Tab") {
      e.preventDefault(); // Prevent default tabbing behavior
  
      // Select only driver input fields
      const driverInputs = Array.from(document.querySelectorAll(".driver-input"));
      const nextIndex = (index + 1) % driverInputs.length;
      driverInputs[nextIndex].focus();
    }
  };
  const handleTeamKeyDown = (e, index) => {
    if (e.key === "Tab") {
      e.preventDefault(); // Prevent default tabbing behavior
  
      const teamInputs = Array.from(document.querySelectorAll(".team-input"));
      const nextIndex = (index + 1) % teamInputs.length;
      teamInputs[nextIndex].focus();
    }
  };

  const handleQualiKeyDown = (e, index) => {
    if (e.key === "Tab") {
      e.preventDefault(); // Prevent default tabbing behavior
  
      const qualiInputs = Array.from(document.querySelectorAll(".quali-input"));
      const nextIndex = (index + 1) % qualiInputs.length;
      qualiInputs[nextIndex].focus();
    }
  };   

  const handleSubmit = async () => {
    if (!selectedRace) {
      console.error("No race selected!");
      return;
    }
  
    // Add `raceId` and ensure `qualifying` is an integer
    const raceData = raceResults.map((result) => ({
      raceId: selectedRace.id, // ✅ Attach raceId to each entry
      position: result.position,
      driver: result.driver.trim(),
      team: result.team.trim(),
      points: result.points,
      dnf: result.dnf,
      qualifying: result.qualifying ? parseInt(result.qualifying, 10) : 0, // ✅ Convert to integer
      pos_Change: result.pos_Change,
    }));
  
    console.log("🚀 Sending Race Data:", raceData);
  
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
      console.log("✅ Submission Successful:", data);
      alert(`${data.message}`); // Show success message to user
    } catch (error) {
      console.error("❌ Error submitting results:", error);
      alert("Error submitting results! Check the console for details.");
    }
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
                {race.name} - Season {race.season}, Round {race.round}, Division {race.division}{" "}
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
        <h2>Add Results for {selectedRace.track.raceName}</h2>
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
                    className="driver-input"
                    value={result.driver}
                    onChange={(e) => handleResultChange(index, "driver", e.target.value)}
                    onKeyDown={(e) => handleDriverKeyDown(e, index)}
                    placeholder="Select or type driver..."
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
                    className="team-input" // Add class for easier selection
                    value={result.team}
                    onChange={(e) => handleResultChange(index, "team", e.target.value)}
                    onKeyDown={(e) => handleTeamKeyDown(e, index)}
                  />
                </td>
                <td>{result.points}</td>
                <td>
                  <select
                    value={result.dnf}
                    onChange={(e) => handleResultChange(index, "dnf", e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    className="quali-input" // Add class for easier selection
                    value={result.qualifying}
                    onChange={(e) => handleResultChange(index, "qualifying", e.target.value)}
                    onKeyDown={(e) => handleQualiKeyDown(e, index)}
                  />
                </td>
                <td>{result.pos_Change}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={result.fastestLap}
                    onChange={(e) => handleResultChange(index, "fastestLap", e.target.checked)}
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
