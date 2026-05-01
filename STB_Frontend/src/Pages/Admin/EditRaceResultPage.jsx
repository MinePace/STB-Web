import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { jwtDecode } from "jwt-decode";
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
  const [searchParams] = useSearchParams();
  const raceIdFromQuery = searchParams.get("race");

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(paramSeason || "");
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRace] = useState(
    raceIdFromQuery || paramRound || ""
  );
  const [selectedDivision, setSelectedDivision] = useState(paramDivision || "");
  const [FastestLap, setFastestLap] = useState(""); // driver name (display only)
  const [raceResults, setRaceResults] = useState([]);
  const [editedResults, setEditedResults] = useState({});
  const [originalPointsByPosition, setOriginalPointsByPosition] = useState({});
  const [token, setToken] = useState("");

  // Only admins allowed
  useEffect(() => {
    const token = localStorage.getItem("token");
    setToken(token || ""); // Store token for API calls
    let role = "user";
  
    if (token) {
      try {
        const decoded = jwtDecode(token);
  
        role = decoded.role;
        if (role !== "Admin") navigate("/");
      } catch (e) {
        console.log("JWT decode failed:", e);
      }
    }
  }, [navigate]);

  // Sync URL params → state
  useEffect(() => {
    if (paramSeason !== undefined) setSelectedSeason(paramSeason || "");
    if (paramDivision !== undefined) setSelectedDivision(paramDivision || "");

    if (raceIdFromQuery) {
      setSelectedRace(raceIdFromQuery);
    } else if (paramRound !== undefined) {
      setSelectedRace(paramRound || "");
    }
  }, [paramSeason, paramDivision, paramRound, raceIdFromQuery]);

  // Load seasons
  useEffect(() => {
    fetch(`https://stbleaguedata.vercel.app/api/race/seasons`)
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setSeasons(data) : setSeasons([])))
      .catch((err) => console.error("Error fetching seasons:", err));
  }, []);

  // Load races for a season
  useEffect(() => {
    if (selectedSeason) {
      fetch(`https://stbleaguedata.vercel.app/api/race/season/${selectedSeason}`)
        .then((res) => res.json())
        .then((data) => setRaces(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error fetching races:", err));
    } else {
      setRaces([]);
    }
  }, [selectedSeason]);

  // Clear race when division changes
  useEffect(() => {
    if (!raceIdFromQuery) {
      setSelectedRace("");
    }
  }, [selectedDivision, raceIdFromQuery]);

  // Helper: when we load race results, also build the original points map
  const hydrateRaceResults = (raceObj) => {
    const results =
      raceObj?.raceResults ??
      raceObj?.RaceResults ??
      raceObj?.results ??
      [];

    const sorted = [...results].sort(
      (a, b) => (a.position ?? a.Position ?? 0) - (b.position ?? b.Position ?? 0)
    );

    setRaceResults(sorted);

    const map = {};
    sorted.forEach((row) => {
      const position = row.position ?? row.Position;

      if (position != null) {
        map[position] = row.points ?? row.Points ?? 0;
      }
    });

    setOriginalPointsByPosition(map);
  };

  // Load race + results (with driver/team objects)
  useEffect(() => {
    if (!selectedRaceId) {
      setRaceResults([]);
      setOriginalPointsByPosition({});
      return;
    }

    fetch(`https://stbleaguedata.vercel.app/api/race/${selectedRaceId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Race API response:", data);

        const raceObj = data?.race ?? data;
        const flObj = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        const season = raceObj?.Season ?? raceObj?.season;
        const division = raceObj?.Division ?? raceObj?.division;

        if (season !== undefined && season !== null) {
          setSelectedSeason(String(season));
        }

        if (division !== undefined && division !== null) {
          setSelectedDivision(String(division));
        }

        hydrateRaceResults(raceObj);

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
  }, [selectedRaceId]);

  function applyPenaltyToTime(timeValue, penaltySeconds) {
    if (!timeValue) return null;

    const time = String(timeValue).trim();
    const penalty = Number(penaltySeconds || 0);

    const isFullTime = /^\d+:\d{2}\.\d{3}$/.test(time); // 39:21.797
    const isGapTime = /^\d+\.\d{3}$/.test(time); // 7.410

    if (!isFullTime && !isGapTime) {
      return time; // 1 Lap, 2 Laps, DNF etc.
    }

    let totalMs = 0;

    if (isFullTime) {
      const [minutesPart, secondsPart] = time.split(":");
      const [seconds, milliseconds] = secondsPart.split(".");

      totalMs =
        Number(minutesPart) * 60 * 1000 +
        Number(seconds) * 1000 +
        Number(milliseconds);
    } else {
      const [seconds, milliseconds] = time.split(".");

      totalMs = Number(seconds) * 1000 + Number(milliseconds);
    }

    totalMs += penalty * 1000;

    if (totalMs < 0) totalMs = 0;

    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;

    if (isFullTime || minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
    }

    return `${seconds}.${String(milliseconds).padStart(3, "0")}`;
  }



  function parseRaceTimeToMs(timeValue) {
    if (!timeValue) return null;

    const time = String(timeValue).trim().replace("+", "");

    // Full time: 44:43.927
    if (/^\d+:\d{2}\.\d{3}$/.test(time)) {
      const [minPart, rest] = time.split(":");
      const [secPart, msPart] = rest.split(".");

      return (
        Number(minPart) * 60 * 1000 +
        Number(secPart) * 1000 +
        Number(msPart)
      );
    }

    // Gap: 0.161 / 2.851 / 21.103
    if (/^\d+\.\d{3}$/.test(time)) {
      const [secPart, msPart] = time.split(".");
      return Number(secPart) * 1000 + Number(msPart);
    }

    return null;
  }

  function formatFullTime(msValue) {
    const totalMs = Math.max(0, Math.round(msValue));

    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  }

  function formatGapTime(msValue) {
    const totalMs = Math.max(0, Math.round(msValue));

    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    // 👉 ALS >= 1 minuut → mm:ss.mmm
    if (minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    }

    // 👉 ANDERS → ss.mmm
    return `${seconds}.${String(ms).padStart(3, "0")}`;
  }

  function calculateTimePenaltyMap(rows, editedResults) {
    if (!rows || rows.length === 0) return {};

    const orderedRows = [...rows].sort(
      (a, b) => (a.position ?? a.Position ?? 0) - (b.position ?? b.Position ?? 0)
    );

    // Zoek de originele volledige racetijd, bijvoorbeeld 44:43.927
    const originalLeaderRow = orderedRows.find((row) => {
      const edited = editedResults[row.id] || {};
      const rawTime = edited.time ?? row.time ?? row.Time ?? "";
      return String(rawTime).includes(":");
    });

    if (!originalLeaderRow) return {};

    const originalLeaderTime =
      editedResults[originalLeaderRow.id]?.time ??
      originalLeaderRow.time ??
      originalLeaderRow.Time;

    const originalLeaderMs = parseRaceTimeToMs(originalLeaderTime);

    if (originalLeaderMs === null) return {};

    const absoluteById = {};

    orderedRows.forEach((row) => {
      const edited = editedResults[row.id] || {};

      const rawTime = edited.time ?? row.time ?? row.Time;
      const penalty = Number(edited.penalty ?? row.penalty ?? row.Penalty ?? 0);

      const parsedMs = parseRaceTimeToMs(rawTime);

      if (parsedMs === null) {
        absoluteById[row.id] = null;
        return;
      }

      const isFullRaceTime = String(rawTime).includes(":");

      const absoluteMs = isFullRaceTime
        ? parsedMs + penalty * 1000
        : originalLeaderMs + parsedMs + penalty * 1000;

      absoluteById[row.id] = absoluteMs;
    });

    // Belangrijk: huidige rij 1 is de nieuwe winnaar
    const currentLeader = orderedRows[0];
    const currentLeaderMs = absoluteById[currentLeader.id];

    if (currentLeaderMs === null || currentLeaderMs === undefined) return {};

    const map = {};

    orderedRows.forEach((row, index) => {
      const absoluteMs = absoluteById[row.id];

      if (absoluteMs === null || absoluteMs === undefined) {
        const edited = editedResults[row.id] || {};
        map[row.id] = edited.time ?? row.time ?? row.Time ?? "";
        return;
      }

      if (index === 0) {
        map[row.id] = formatFullTime(absoluteMs);
      } else {
        const gapMs = absoluteMs - currentLeaderMs;
        map[row.id] = `${formatGapTime(gapMs)}`;
      }
    });

    return map;
  }

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
      TimePenalty: applyPenaltyToTime(updated.time ?? base.time, updated.penalty ?? base.penalty),
    };

    console.log("Saving DTO:", dto);
    const resp = await fetch(
      `https://stbleaguedata.vercel.app/api/race/raceresult/update/${id}`,
      {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
         },
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
          TimePenalty: applyPenaltyToTime(updated.time ?? base.time, updated.penalty ?? base.penalty),
        };

        return fetch(`https://stbleaguedata.vercel.app/api/race/raceresult/update/${id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
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
    fetch(`https://stbleaguedata.vercel.app/api/race/${selectedRaceId}`)
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
      `https://stbleaguedata.vercel.app/api/race/raceresult/delete/${id}`,
      { 
        method: "DELETE",
        headers: { 
          "Authorization": `Bearer ${token}`
         }, 
      }
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
          (r) => !selectedSeason || String(r.Season) === String(selectedSeason)
        )
        .map((r) => r.Division)
        .filter((v) => v !== undefined && v !== null)
    );
    return Array.from(set).sort(
      (a, b) => a - b || String(a).localeCompare(String(b))
    );
  }, [races, selectedSeason]);

  const filteredRaces = useMemo(() => {
    return races
      .filter(
        (r) => !selectedSeason || String(r.Season) === String(selectedSeason)
      )
      .filter(
        (r) =>
          !selectedDivision || String(r.Division) === String(selectedDivision)
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
            value={selectedRaceId}
            onChange={(e) => setSelectedRace(e.target.value)}
          >
            <option value="">-- Select Race --</option>
            {filteredRaces.map((r) => (
              <option key={r.Id} value={r.Id}>
                Round: {r.Round} - T{r.Division}
              </option>
            ))}
            {filteredRaces.length === 0 && (
              <option disabled>No races for this selection</option>
            )}
          </select>
        </div>
      )}

      {/* Results Table */}
      {selectedSeason && selectedRaceId && (
        <>
          <h2>
            Race Results{type ? ` - ${type}` : ""} • Id {selectedRaceId} • Season{" "}
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
                    <th>Time + Penalty</th>
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
                                    {
                                      calculateTimePenaltyMap(raceResults, editedResults)[result.id] ?? ""
                                    }
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
