import React, { useState, useEffect, useRef } from "react";

function AddRaceResults() {
  const [races, setRaces] = useState([]); // Lijst met races
  const [selectedRace, setSelectedRace] = useState(null); // Geselecteerde race
  const [raceResults, setRaceResults] = useState([]); // Ingevoerde resultaten
  const [nextPosition, setNextPosition] = useState(1); // Houdt de volgende Final Position bij
  const [newResult, setNewResult] = useState({
    position: "", // Dit wordt automatisch ingevuld
    driver: "",
    team: "",
    points: "",
    dnf: "",
    pos_Change: 0, // Automatisch berekend
    qualifying: "",
  });

  const driverInputRef = useRef(null); // Ref voor focus

  // 🏁 Haal de races op bij het laden van de pagina
  useEffect(() => {
    fetch("http://localhost:5110/api/race/races")
      .then((res) => res.json())
      .then((data) => setRaces(data))
      .catch((err) => console.error("Error fetching races:", err));
  }, []);

  // 🏁 Selecteer een race
  const handleRaceSelect = (e) => {
    const raceId = e.target.value;
    const race = races.find((r) => r.id.toString() === raceId);
    setSelectedRace(race || null);
    setRaceResults([]); // Reset resultaten bij nieuwe race
    setNextPosition(1); // Reset de Final Position teller
  };

  // 🏎️ Input handler voor resultaten
  const handleResultChange = (e) => {
    const { name, value } = e.target;

    setNewResult((prev) => {
      const updatedResult = { ...prev, [name]: value };

      // Bereken Position Change automatisch
      if (name === "position" || name === "qualifying") {
        const positionChange =
          updatedResult.qualifying && updatedResult.position
            ? updatedResult.qualifying - updatedResult.position
            : 0;
        updatedResult.pos_Change = positionChange;
      }

      return updatedResult;
    });
  };

  // ❌ Controleer of alle velden zijn ingevuld
  const isResultValid = () => {
    return (
      selectedRace &&
      newResult.driver &&
      newResult.team &&
      newResult.points &&
      newResult.dnf &&
      newResult.qualifying
    );
  };

  // ➕ Voeg een nieuw resultaat toe
  const handleAddResult = () => {
    if (!isResultValid()) return;

    // Check voor dubbele Qualifying Position
    const duplicateQualifying = raceResults.some(
      (result) => result.qualifying === newResult.qualifying
    );
    if (duplicateQualifying) {
      alert("Duplicate Qualifying Position! Please assign a different Qualifying Position.");
      return;
    }

    // Voeg nieuwe result toe met automatische Final Position
    const updatedResult = {
      ...newResult,
      position: nextPosition, // Automatische Final Position
      raceId: selectedRace.id,
    };

    setRaceResults((prev) => [...prev, updatedResult]);
    setNewResult({
      position: nextPosition + 1, // Voorstel voor volgende positie
      driver: "",
      team: "",
      points: "",
      dnf: "",
      pos_Change: 0,
      qualifying: "",
    });
    setNextPosition(nextPosition + 1); // Verhoog de Final Position teller
    driverInputRef.current.focus(); // Zet focus op Driver Name
  };

  // ❌ Verwijder een resultaat uit de lijst
  const handleRemoveResult = (index) => {
    const updatedResults = [...raceResults];
    updatedResults.splice(index, 1); // Verwijder resultaat
    setRaceResults(updatedResults);

    // Reset de Final Positions opnieuw vanaf 1
    const reIndexedResults = updatedResults.map((result, i) => ({
      ...result,
      position: i + 1,
    }));
    setRaceResults(reIndexedResults);
    setNextPosition(reIndexedResults.length + 1);
  };

  // 📤 Verstuur alle resultaten
  const handleSubmit = async () => {
    if (!selectedRace) {
      alert("Please select a race before submitting results.");
      return;
    }

    const response = await fetch("http://localhost:5110/api/race/raceresults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raceResults),
    });

    if (response.ok) {
      alert(`${raceResults.length} Race Results Added Successfully!`);
      setRaceResults([]);
      setNextPosition(1);
    } else {
      alert("Failed to add race results. Please try again.");
    }
  };

  return (
    <div className="add-race-results-container">
      <h1>Add Race Results</h1>

      {/* 🏁 Selecteer Race */}
      <div className="race-settings">
        <h2>Select Race</h2>
        <select onChange={handleRaceSelect} required>
          <option value="">Select a Race</option>
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              {race.name} - Season {race.season}, Round {race.round}, Division {race.division}
            </option>
          ))}
        </select>
      </div>

      {/* Formulier voor een nieuw race resultaat */}
      <div className="result-form">
        <h2>Add Result</h2>
        <input
          type="number"
          name="position"
          placeholder="Final Position"
          value={newResult.position}
          onChange={handleResultChange}
          readOnly // Automatisch ingevuld
        />
        <input
          type="text"
          name="driver"
          placeholder="Driver Name"
          value={newResult.driver}
          onChange={handleResultChange}
          ref={driverInputRef}
        />
        <input
          type="text"
          name="team"
          placeholder="Team Name"
          value={newResult.team}
          onChange={handleResultChange}
        />
        <input
          type="number"
          name="points"
          placeholder="Points"
          value={newResult.points}
          onChange={handleResultChange}
        />
        <input
          type="text"
          name="dnf"
          placeholder="DNF (Yes/No)"
          value={newResult.dnf}
          onChange={handleResultChange}
        />
        <input
          type="number"
          name="qualifying"
          placeholder="Qualifying Position"
          value={newResult.qualifying}
          onChange={handleResultChange}
        />
        <button onClick={handleAddResult} disabled={!isResultValid()}>
          Add to List
        </button>
      </div>

      {/* Lijst van ingevoerde resultaten */}
      <div className="results-list">
        <h2>Race Results to Submit:</h2>
        <ul>
          {raceResults.map((result, index) => (
            <li key={index}>
              {result.driver} - {result.team} - Position: {result.position} - Points: {result.points} - Position Change:{" "}
              {result.pos_Change}{" "}
              <button onClick={() => handleRemoveResult(index)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Verstuur naar backend */}
      <button onClick={handleSubmit} disabled={raceResults.length === 0}>
        Submit All Results
      </button>
    </div>
  );
}

export default AddRaceResults;
