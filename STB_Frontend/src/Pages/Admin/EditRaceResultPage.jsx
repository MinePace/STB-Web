import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./EditRaceResultPage.css";
import "@/Components/Links.css";

function EditRaceResults() {
  const { season: paramSeason, round: paramRound, division: paramDivision, type } = useParams();
  const navigate = useNavigate();
  const pointsForPosition = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(paramSeason || "");
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(paramRound || "");
  const [selectedDivision, setSelectedDivision] = useState(paramDivision || ""); // FIX
  const [FastestLap, setFastestLap] = useState(""); // store as driver name (string) // FIX
  const [raceResults, setRaceResults] = useState([]);
  const [editedResults, setEditedResults] = useState({});

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // Keep state in sync with URL changes (optional but nice to have) // FIX
  useEffect(() => {
    if (paramSeason !== undefined) setSelectedSeason(paramSeason || "");
    if (paramDivision !== undefined) setSelectedDivision(paramDivision || "");
    if (paramRound !== undefined) setSelectedRace(paramRound || "");
  }, [paramSeason, paramDivision, paramRound]);

  useEffect(() => {
    fetch(`http://localhost:5110/api/race/seasons`)
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setSeasons(data) : setSeasons([])))
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
      setSelectedDivision(""); // optional: also clear division when season cleared // FIX
    }
  }, [selectedSeason]);

  // Clear race when division changes (prevents showing races from a different division) // FIX
  useEffect(() => {
    setSelectedRace("");
  }, [selectedDivision]);

  useEffect(() => {
    if (!selectedRace) {
      setRaceResults([]);
      return;
    }
    fetch(`http://localhost:5110/api/race/race/${selectedRace}`)
      .then(res => res.json())
      .then(data => {
        const raceObj = data?.race ?? data;
        const flObj   = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        setRaceResults(raceObj?.raceResults ?? []);

        // If you keep this, be sure it's defined somewhere
        // if (raceObj?.youtubeLink) extractYouTubeEmbed(raceObj.youtubeLink);

        // Try to resolve a driver name from various shapes // FIX
        if (flObj) {
          const name =
            flObj?.driver?.name ??           // { fastestLap: { driver: { name } } }
            flObj?.driverName ??             // { fastestLap: { driverName } }
            flObj?.name ??                   // { fastestLap: { name } }
            (typeof flObj === "string" ? flObj : "");
          setFastestLap(name || "");
        } else {
          setFastestLap("");
        }
      })
      .catch(err => console.error("Error fetching race results:", err));
  }, [selectedRace]);

  // If you also have a dedicated fastest-lap endpoint, make it tolerant to object/string // FIX
  useEffect(() => {
    if (!selectedSeason || !selectedRace) return;
    fetch(`http://localhost:5110/api/fastestlap/${selectedRace}`)
      .then(async (res) => {
        const text = await res.text();
        try {
          const obj = JSON.parse(text);
          const name =
            obj?.driver?.name ??
            obj?.driverName ??
            obj?.name ??
            (typeof obj === "string" ? obj : "");
          setFastestLap(name || "");
        } catch {
          // not JSON, assume plain name
          setFastestLap(text || "");
        }
      })
      .catch((err) => console.error("Error fetching fastest lap:", err));
  }, [selectedSeason, selectedRace]);

  const handleInputChange = (id, field, value) => {
    setEditedResults((prev) => {
      const existing = prev[id] || raceResults.find((r) => r.id === id) || {};
      const updated = { ...existing, [field]: value };

      const position = updated.position ?? existing.position;
      const qualifying = updated.qualifying ?? existing.qualifying;
      if (position != null && qualifying != null) {
        updated.pos_Change = qualifying - position;
      }
      return { ...prev, [id]: updated };
    });
  };

  const handleSave = async (id) => {
    const base = raceResults.find(r => r.id === id);
    const updated = editedResults[id];
    if (!base && !updated) return;

    const dto = {
      Position: updated?.position ?? base.position,
      Driver: updated?.driver ?? base.driver,
      Team: updated?.team ?? base.team,
      Points: updated?.points ?? base.points,
      DNF: updated?.dnf ?? base.dnf,
      Qualifying: updated?.qualifying ?? base.qualifying,
      Pos_Change: updated?.pos_Change ?? base.pos_Change,
      Time: updated?.time ?? base.time
    };

    const resp = await fetch(`http://localhost:5110/api/raceresult/update/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });

    alert(resp.ok ? "Race result updated successfully!" : "Failed to update result.");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this result?")) return;
    const resp = await fetch(`http://localhost:5110/api/raceresult/delete/${id}`, { method: "DELETE" });
    if (resp.ok) {
      alert("Race result deleted successfully!");
      setRaceResults((prev) => prev.filter((r) => r.id !== id));
      setEditedResults((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } else {
      alert("Failed to delete result.");
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const updated = [...raceResults];
    const [movedRow] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, movedRow);

    // Recalculate positions, points, and pos_Change // FIX
    updated.forEach((row, i) => {
      row.position = i + 1;
      row.points = pointsForPosition[row.position - 1] || 0;
      const quali = row.qualifying ?? row.position;
      row.pos_Change = quali - row.position;
    });

    // Fastest lap extra point if in top 10 (and optionally not DNF)
    if (FastestLap) {
      const idx = updated.findIndex((row) => row.driver === FastestLap);
      if (idx !== -1 && updated[idx].position <= 10 /* && updated[idx].dnf !== "Yes" */) {
        updated[idx].points += 1;
      }
    }

    setRaceResults(updated);

    // Mirror into editedResults
    setEditedResults((prev) => {
      const next = { ...prev };
      updated.forEach((row) => {
        next[row.id] = {
          ...(next[row.id] || {}),
          position: row.position,
          points: row.points,
          pos_Change: row.pos_Change,
        };
      });
      return next;
    });
  };

  const uniqueDivisions = useMemo(() => {
    const set = new Set(
      races
        .filter(r => !selectedSeason || String(r.season) === String(selectedSeason))
        .map(r => r.division)
        .filter(v => v !== undefined && v !== null)
    );
    return Array.from(set).sort((a, b) => (a - b) || String(a).localeCompare(String(b)));
  }, [races, selectedSeason]);

  const filteredRaces = useMemo(() => {
    return races
      .filter(r => !selectedSeason || String(r.season) === String(selectedSeason))
      .filter(r => !selectedDivision || String(r.division) === String(selectedDivision));
  }, [races, selectedSeason, selectedDivision]);

  return (
    <div className="edit-race-results-container">
      <h1>Edit Race Results</h1>

      {/* Season Selection */}
      <div>
        <label>Select Season: </label>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
        >
          <option value="">-- Select Season --</option>
          {seasons.length > 0 ? (
            seasons.map((s) => (
              <option key={s} value={s}>Season {s}</option>
            ))
          ) : (
            <option disabled>No seasons available</option>
          )}
        </select>
      </div>

      {/* Division / Tier Selection */}
      {selectedSeason && (
        <div>
          <label>Select Division / Tier: </label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
          >
            <option value="">-- All Divisions --</option>
            {uniqueDivisions.length > 0 ? (
              uniqueDivisions.map((d) => (
                <option key={d} value={d}>T{d}</option>
              ))
            ) : (
              <option disabled>No divisions available</option>
            )}
          </select>
        </div>
      )}

      {/* Race Selection */}
      {selectedSeason && (
        <div>
          <label>Select Race: </label>
          <select
            value={selectedRace}
            onChange={(e) => setSelectedRace(e.target.value)}
          >
            <option value="">-- Select Race --</option>
            {filteredRaces.map((r) => (
              <option key={r.id} value={r.id}>
                Round: {r.round} - T{r.division}
              </option>
            ))}
            {filteredRaces.length === 0 && (
              <option disabled>No races for this selection</option>
            )}
          </select>
        </div>
      )}

      {/* Race Results Table */}
      {selectedSeason && selectedRace && (
        <>
          <h2>
            Race Results{type ? ` - ${type}` : ""} • Id {selectedRace} • Season {selectedSeason}
          </h2>

          {raceResults.length === 0 ? (
            <p style={{ color: "red", fontWeight: "bold" }}>
              There are no results for this race
            </p>
          ) : (
            <>
              <table className="race-results-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Pts</th>
                    <th>DNF</th>
                    <th>Quali</th>
                    <th>Pos Δ</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="raceResults">
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps}>
                        {raceResults.map((result, index) => (
                          <Draggable key={result.id} draggableId={String(result.id)} index={index}>
                            {(prov) => (
                              <tr ref={prov.innerRef} {...prov.draggableProps}>
                                <td {...prov.dragHandleProps} style={{ cursor: "grab" }}>⠿</td>

                                <td>{result.position}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="compact-input"
                                    value={editedResults[result.id]?.driver ?? result.driver ?? ""}
                                    onChange={(e) => handleInputChange(result.id, "driver", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="compact-input"
                                    value={editedResults[result.id]?.team ?? result.team ?? ""}
                                    onChange={(e) => handleInputChange(result.id, "team", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="compact-input"
                                    value={editedResults[result.id]?.points ?? result.points ?? 0}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : Number(e.target.value);
                                      handleInputChange(result.id, "points", v);
                                    }}
                                  />
                                </td>
                                <td>
                                  <select
                                    className="compact-select"
                                    value={editedResults[result.id]?.dnf ?? result.dnf ?? "No"}
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
                                    value={editedResults[result.id]?.qualifying ?? result.qualifying ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? "" : Number(e.target.value);
                                      handleInputChange(result.id, "qualifying", v);
                                    }}
                                  />
                                </td>
                                <td>{editedResults[result.id]?.pos_Change ?? result.pos_Change ?? ""}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="compact-input"
                                    value={editedResults[result.id]?.time ?? result.time ?? ""}
                                    onChange={(e) => handleInputChange(result.id, "time", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <button className="submit-button" onClick={() => handleSave(result.id)}>Save</button>
                                  <button className="delete-btn" onClick={() => handleDelete(result.id)}>Delete</button>
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </>
          )}

          <button className="cancel-btn" onClick={() => navigate(-1)}>Cancel</button>
        </>
      )}
    </div>
  );
}

export default EditRaceResults;
