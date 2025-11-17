import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./EditRaceResultPage.css";
import "@/Components/Links.css";

function EditRaceResults() {
  const {
    season: paramSeason,
    round: paramRound,
    division: paramDivision,
    type,
  } = useParams();
  const navigate = useNavigate();

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(paramSeason || "");
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(paramRound || "");
  const [selectedDivision, setSelectedDivision] = useState(paramDivision || "");
  const [FastestLap, setFastestLap] = useState(""); // driver name (display only)
  const [raceResults, setRaceResults] = useState([]);
  const [editedResults, setEditedResults] = useState({});
  const [originalPointsByPosition, setOriginalPointsByPosition] = useState({});

  // Only admins allowed
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // Sync URL params → state
  useEffect(() => {
    if (paramSeason !== undefined) setSelectedSeason(paramSeason || "");
    if (paramDivision !== undefined) setSelectedDivision(paramDivision || "");
    if (paramRound !== undefined) setSelectedRace(paramRound || "");
  }, [paramSeason, paramDivision, paramRound]);

  // Load seasons
  useEffect(() => {
    fetch(`http://localhost:5110/api/race/seasons`)
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setSeasons(data) : setSeasons([])))
      .catch((err) => console.error("Error fetching seasons:", err));
  }, []);

  // Load races for a season
  useEffect(() => {
    if (selectedSeason) {
      fetch(`http://localhost:5110/api/race/races/${selectedSeason}`)
        .then((res) => res.json())
        .then((data) => setRaces(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error fetching races:", err));
    } else {
      setRaces([]);
      setSelectedRace("");
      setSelectedDivision("");
    }
  }, [selectedSeason]);

  // Clear race when division changes
  useEffect(() => {
    setSelectedRace("");
  }, [selectedDivision]);

  // Helper: when we load race results, also build the original points map
  const hydrateRaceResults = (raceObj) => {
    const results = raceObj?.raceResults ?? [];
    const sorted = [...results].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    setRaceResults(sorted);

    // Snapshot: which points belong to each finishing position
    const map = {};
    sorted.forEach((row) => {
      if (row.position != null) {
        map[row.position] = row.points ?? 0;
      }
    });
    setOriginalPointsByPosition(map);
  };

  // Load race + results (with driver/team objects)
  useEffect(() => {
    if (!selectedRace) {
      setRaceResults([]);
      setOriginalPointsByPosition({});
      return;
    }

    fetch(`http://localhost:5110/api/race/race/${selectedRace}`)
      .then((res) => res.json())
      .then((data) => {
        const raceObj = data?.race ?? data;
        const flObj = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        hydrateRaceResults(raceObj);

        // Fastest lap (display only, not used for points anymore)
        if (flObj) {
          const name =
            flObj?.driver?.name ??
            flObj?.driverName ??
            flObj?.name ??
            (typeof flObj === "string" ? flObj : "");
          setFastestLap(name || "");
        } else {
          setFastestLap("");
        }
      })
      .catch((err) => console.error("Error fetching race results:", err));
  }, [selectedRace]);

  // Optional: dedicated fastest-lap endpoint (again, only to display name)
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
          setFastestLap(text || "");
        }
      })
      .catch((err) => console.error("Error fetching fastest lap:", err));
  }, [selectedSeason, selectedRace]);

  /** Generic field change */
  const handleInputChange = (id, field, value) => {
    setEditedResults((prev) => {
      const base = raceResults.find((r) => r.id === id) || {};
      const existing = prev[id] || {};
      const updated = { ...existing, [field]: value };

      // Recompute pos_Change when pos or quali changes
      const position =
        field === "position" ? value : existing.position ?? base.position;
      const qualifying =
        field === "qualifying" ? value : existing.qualifying ?? base.qualifying;

      if (
        position !== null &&
        position !== undefined &&
        qualifying !== null &&
        qualifying !== undefined
      ) {
        updated.pos_Change = qualifying - position;
      }

      return { ...prev, [id]: updated };
    });
  };

  /** Save ONE row */
  const handleSave = async (id) => {
    const base = raceResults.find((r) => r.id === id);
    const updated = editedResults[id] || {};
    if (!base && !updated) return;

    // Flatten driver/team names for DTO
    const driverName =
      updated.driver ??
      base?.driver?.name ??
      (typeof base?.driver === "string" ? base.driver : "");
    const teamName =
      updated.team ??
      base?.team?.name ??
      (typeof base?.team === "string" ? base.team : "");

    const dto = {
      Position: updated.position ?? base.position,
      Driver: driverName,
      Team: teamName,
      Points: updated.points ?? base.points,
      DNF: updated.dnf ?? base.dnf,
      Qualifying: updated.qualifying ?? base.qualifying,
      Pos_Change: updated.pos_Change ?? base.pos_Change,
      Time: updated.time ?? base.time,
      Penalty: updated.penalty ?? base.penalty,
    };

    console.log("Saving DTO:", dto);
    const resp = await fetch(
      `http://localhost:5110/api/raceresult/update/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }
    );

    alert(
      resp.ok ? "Race result updated successfully!" : "Failed to update result."
    );
  };

  /** Save ALL edited rows */
  const handleSaveAll = async () => {
    const editedIds = Object.keys(editedResults);
    if (editedIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    if (!window.confirm("Are you sure you want to save all edited results?"))
      return;

    const updates = editedIds
      .map((idStr) => {
        const id = parseInt(idStr, 10);
        const base = raceResults.find((r) => r.id === id);
        const updated = editedResults[idStr] || {};
        if (!base && !updated) return null;

        const driverName =
          updated.driver ??
          base?.driver?.name ??
          (typeof base?.driver === "string" ? base.driver : "");
        const teamName =
          updated.team ??
          base?.team?.name ??
          (typeof base?.team === "string" ? base.team : "");

        const dto = {
          Position: updated.position ?? base.position,
          Driver: driverName,
          Team: teamName,
          Points: updated.points ?? base.points,
          DNF: updated.dnf ?? base.dnf,
          Qualifying: updated.qualifying ?? base.qualifying,
          Pos_Change: updated.pos_Change ?? base.pos_Change,
          Time: updated.time ?? base.time,
          Penalty: updated.penalty ?? base.penalty,
        };

        return fetch(`http://localhost:5110/api/raceresult/update/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        }).then((res) => ({
          id,
          success: res.ok,
        }));
      })
      .filter(Boolean);

    const results = await Promise.all(updates);
    const failed = results.filter((r) => !r.success);

    if (failed.length > 0) {
      alert(`⚠️ ${failed.length} result(s) failed to save.`);
    } else {
      alert("✅ All race results saved successfully!");
    }

    // Clear edits & refetch fresh data (and refresh original points map)
    setEditedResults({});
    fetch(`http://localhost:5110/api/race/race/${selectedRace}`)
      .then((res) => res.json())
      .then((data) => {
        const raceObj = data?.race ?? data;
        hydrateRaceResults(raceObj);
      })
      .catch((err) => console.error("Error refreshing data:", err));
  };

  /** Delete one row */
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this result?")) return;
    const resp = await fetch(
      `http://localhost:5110/api/raceresult/delete/${id}`,
      { method: "DELETE" }
    );
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

  /**
   * Drag & drop reorder
   * - We NEVER recompute points from a fixed scoring table.
   * - Instead, we preserve the original points distribution per position:
   *   position 1 keeps its DB points, position 2 keeps its DB points, etc.
   * - After reordering, drivers inherit the points of the position they move to.
   */
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const updated = [...raceResults];
    const [movedRow] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, movedRow);

    updated.forEach((row, i) => {
      const newPos = i + 1;
      row.position = newPos;

      // Preserve DB points per position
      if (Object.prototype.hasOwnProperty.call(originalPointsByPosition, newPos)) {
        row.points = originalPointsByPosition[newPos];
      }

      const quali =
        row.qualifying !== null && row.qualifying !== undefined
          ? row.qualifying
          : newPos;
      row.pos_Change = quali - newPos;
    });

    setRaceResults(updated);

    // Mirror to editedResults (only fields affected by reorder)
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

  /** Derived lists */
  const uniqueDivisions = useMemo(() => {
    const set = new Set(
      races
        .filter(
          (r) => !selectedSeason || String(r.season) === String(selectedSeason)
        )
        .map((r) => r.division)
        .filter((v) => v !== undefined && v !== null)
    );
    return Array.from(set).sort(
      (a, b) => a - b || String(a).localeCompare(String(b))
    );
  }, [races, selectedSeason]);

  const filteredRaces = useMemo(() => {
    return races
      .filter(
        (r) => !selectedSeason || String(r.season) === String(selectedSeason)
      )
      .filter(
        (r) =>
          !selectedDivision || String(r.division) === String(selectedDivision)
      );
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
              <option key={s} value={s}>
                Season {s}
              </option>
            ))
          ) : (
            <option disabled>No seasons available</option>
          )}
        </select>
      </div>

      {/* Division Selection */}
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
                <option key={d} value={d}>
                  T{d}
                </option>
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

      {/* Results Table */}
      {selectedSeason && selectedRace && (
        <>
          <h2>
            Race Results{type ? ` - ${type}` : ""} • Id {selectedRace} • Season{" "}
            {selectedSeason}
          </h2>

          {FastestLap && (
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              Fastest Lap: <strong>{FastestLap}</strong> (points already baked
              into the table if applicable)
            </p>
          )}

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
                    <th>Penalty</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="raceResults">
                    {(provided) => (
                      <tbody
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {raceResults.map((result, index) => {
                          const driverName =
                            editedResults[result.id]?.driver ??
                            result.driver?.name ??
                            (typeof result.driver === "string"
                              ? result.driver
                              : "") ??
                            "";
                          const teamName =
                            editedResults[result.id]?.team ??
                            result.team?.name ??
                            (typeof result.team === "string"
                              ? result.team
                              : "") ??
                            "";

                          return (
                            <Draggable
                              key={result.id}
                              draggableId={String(result.id)}
                              index={index}
                            >
                              {(prov) => (
                                <tr
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                >
                                  <td
                                    {...prov.dragHandleProps}
                                    style={{ cursor: "grab" }}
                                  >
                                    ⠿
                                  </td>

                                  <td>{result.position}</td>

                                  <td>
                                    <input
                                      type="text"
                                      className="compact-input"
                                      value={driverName}
                                      onChange={(e) =>
                                        handleInputChange(
                                          result.id,
                                          "driver",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>

                                  <td>
                                    <input
                                      type="text"
                                      className="compact-input"
                                      value={teamName}
                                      onChange={(e) =>
                                        handleInputChange(
                                          result.id,
                                          "team",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      className="compact-input"
                                      step="0.5"
                                      value={
                                        editedResults[result.id]?.points ??
                                        result.points ??
                                        0
                                      }
                                      onChange={(e) => {
                                        const v =
                                          e.target.value === ""
                                            ? ""
                                            : Number(e.target.value);
                                        handleInputChange(
                                          result.id,
                                          "points",
                                          v
                                        );
                                      }}
                                    />
                                  </td>

                                  <td>
                                    <select
                                      className="compact-select"
                                      value={
                                        editedResults[result.id]?.dnf ??
                                        result.dnf ??
                                        "No"
                                      }
                                      onChange={(e) =>
                                        handleInputChange(
                                          result.id,
                                          "dnf",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="No">No</option>
                                      <option value="Yes">Yes</option>
                                      <option value="DNF">DNF</option>
                                    </select>
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      className="compact-input"
                                      value={
                                        editedResults[result.id]
                                          ?.qualifying ??
                                        result.qualifying ??
                                        ""
                                      }
                                      onChange={(e) => {
                                        const v =
                                          e.target.value === ""
                                            ? ""
                                            : Number(e.target.value);
                                        handleInputChange(
                                          result.id,
                                          "qualifying",
                                          v
                                        );
                                      }}
                                    />
                                  </td>

                                  <td>
                                    {editedResults[result.id]?.pos_Change ??
                                      result.pos_Change ??
                                      ""}
                                  </td>

                                  <td>
                                    <input
                                      type="text"
                                      className="compact-input"
                                      value={
                                        editedResults[result.id]?.time ??
                                        result.time ??
                                        ""
                                      }
                                      onChange={(e) =>
                                        handleInputChange(
                                          result.id,
                                          "time",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      className="compact-input"
                                      value={
                                        editedResults[result.id]?.penalty ??
                                        result.penalty ??
                                        0
                                      }
                                      step="1"
                                      onChange={(e) => {
                                        let v = e.target.value;
                                        if (v === "") v = "";
                                        else if (/^-?\d+$/.test(v))
                                          v = parseInt(v, 10);
                                        else return;
                                        handleInputChange(
                                          result.id,
                                          "penalty",
                                          v
                                        );
                                      }}
                                    />
                                  </td>

                                  <td>
                                    <button
                                      className="submit-button"
                                      onClick={() => handleSave(result.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="delete-btn"
                                      onClick={() =>
                                        handleDelete(result.id)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </>
          )}

          <div style={{ marginTop: "20px" }}>
            <button
              className="submit-button"
              style={{ marginRight: "10px" }}
              onClick={handleSaveAll}
            >
              💾 Save All
            </button>
            <button className="cancel-btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default EditRaceResults;
