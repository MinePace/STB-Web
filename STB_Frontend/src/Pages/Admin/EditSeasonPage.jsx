import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import "./EditSeasonPage.css";
import "@/Components/Links.css";

/**
 * Key changes vs your original:
 * - Always send `trackId` (as a Number) in PUT payloads so circuit updates persist.
 * - Parse <select> values to numbers to avoid string/number mismatches.
 * - Simplified update payload (no need to fetch full Track for PUT).
 * - Minor cleanups for change detection & disabled states.
 */
function EditSeasonPage() {
  const navigate = useNavigate();

  // Filters
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  // Data
  const [allRacesForSeason, setAllRacesForSeason] = useState([]);
  const [rows, setRows] = useState([]); // editable copy (filtered by division)
  const [originalRows, setOriginalRows] = useState([]); // for change detection

  // Tracks
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState(null);

  // ----- Teams & Drivers -----
  const [teamDrivers, setTeamDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingTeamDrivers, setLoadingTeamDrivers] = useState(false);
  const [savingTeamDrivers, setSavingTeamDrivers] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);

  // ----- Auth guard -----
  useEffect(() => {
    const token = localStorage.getItem("token");
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

  // ----- Load seasons -----
  useEffect(() => {
    fetch("https://stbleaguedata.vercel.app/api/race/seasons")
      .then((r) => r.json())
      .then(setSeasons)
      .catch((e) => console.error("seasons error:", e));
  }, []);

  // ----- Load races when season changes -----
  useEffect(() => {
    setAllRacesForSeason([]);
    setRows([]);
    setOriginalRows([]);

    if (!selectedSeason) return;
    fetch(`https://stbleaguedata.vercel.app/api/race/season/${selectedSeason}`)
      .then((r) => r.json())
      .then((list) => {
        // normalize + sort by round
        const sorted = (list || []).slice().sort((a, b) => a.Round - b.Round);
        setAllRacesForSeason(sorted);
      })
      .catch((e) => console.error("races error:", e));
  }, [selectedSeason]);

  // ----- Load team-driver mappings -----
  useEffect(() => {
    if (!selectedSeason || !selectedDivision) {
      setTeamDrivers([]);
      return;
    }

    setLoadingTeamDrivers(true);

    Promise.all([
      fetch(`https://stbleaguedata.vercel.app/api/team/teamdriver/${selectedSeason}/${selectedDivision}`).then((r) => r.json()),
      fetch(`https://stbleaguedata.vercel.app/api/team`).then((r) => r.json()),
      fetch(`https://stbleaguedata.vercel.app/api/driver`).then((r) => r.json()),
    ])
      .then(([teamDriverData, teamList, driverList]) => {
        setTeamDrivers(teamDriverData || []);
        setTeams(teamList || []);
        setDrivers(driverList || []);
      })
      .catch((e) => console.error("TeamDrivers load error:", e))
      .finally(() => setLoadingTeamDrivers(false));
  }, [selectedSeason, selectedDivision]);

  // ----- Filter by division into editable rows -----
  useEffect(() => {
    if (!selectedDivision) {
      setRows([]);
      setOriginalRows([]);
      return;
    }
    const filtered = allRacesForSeason
      .filter((r) => String(r.Division) === String(selectedDivision))
      .map((r) => ({
        Id: r.Id,
        F1_Game: r.F1_Game,
        Season: Number(r.Season),
        Division: Number(r.Division),
        Round: Number(r.Round),
        Sprint: r.Sprint || "No",
        YoutubeLink: r.YoutubeLink || "",
        Date: r.Date
          ? new Date(r.Date).toISOString().slice(0, 10)
          : "",
        // ensure trackId is a number for consistent payloads
        TrackId: r.Track?.Id ?? r.TrackId ?? "",
      }));
    setRows(filtered);
    setOriginalRows(filtered);
  }, [allRacesForSeason, selectedDivision]);

  // ----- Load tracks (once) -----
  useEffect(() => {
    let abort = false;
    setTracksLoading(true);
    setTracksError(null);

    (async () => {
      try {
        const res = await fetch("https://stbleaguedata.vercel.app/api/track");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        let arr = [];
        if (Array.isArray(json)) arr = json;
        else if (Array.isArray(json?.data)) arr = json.data;
        else if (Array.isArray(json?.tracks)) arr = json.tracks;
        else {
          const firstArray = Object.values(json || {}).find(Array.isArray);
          if (firstArray) arr = firstArray;
        }
        if (!Array.isArray(arr)) throw new Error("Track list not found.");

        if (!abort) setTracks(arr);
      } catch (e) {
        if (!abort) setTracksError(e.message || "Failed to load tracks");
      } finally {
        if (!abort) setTracksLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);

  // Create a blank row (new race)
  const makeBlankRow = (afterRound, defaults = {}) => ({
    Id: undefined, // new
    F1_Game: rows[0]?.F1_Game ?? allRacesForSeason[0]?.F1_Game ?? 24,
    Season: Number(selectedSeason),
    Division: Number(selectedDivision),
    Round: afterRound + 1,
    Sprint: "No",
    YoutubeLink: "",
    Date: "",
    TrackId: "", // must choose
    ...defaults,
  });

  // Re-number rounds from top to bottom (1..n)
  const renumberRounds = (list) => list.map((r, i) => ({ ...r, Round: i + 1 }));

  // Insert a blank row after index i
  const addRowAfter = (i) => {
    setRows((prev) => {
      const copy = [...prev];
      const afterRound = copy[i]?.Round ?? copy.length;
      copy.splice(i + 1, 0, makeBlankRow(afterRound));
      return renumberRounds(copy);
    });
  };

  // Append at the end
  const addRowAtEnd = () => {
    setRows((prev) => {
      const afterRound = prev[prev.length - 1]?.Round ?? 0;
      const copy = [...prev, makeBlankRow(afterRound)];
      return renumberRounds(copy);
    });
  };

  // ----- Helpers -----
  const updateCell = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const isChanged = (r, o) => JSON.stringify(r) !== JSON.stringify(o);

  const changedRows = useMemo(() => {
    const list = [];
    rows.forEach((r, i) => {
      const o = originalRows[i];
      if (!o) return;
      if (isChanged(r, o)) list.push(r);
    });
    return list;
  }, [rows, originalRows]);

  // Build PUT payload for updates (send TrackId explicitly!)
  const toUpdatePayload = (row) => ({
    // Match the new Update endpoint (DTO expects PascalCase and TrackId only)
    F1_Game: row.F1_Game,
    Season: row.Season,
    Division: row.Division,
    Round: row.Round,
    Sprint: row.Sprint || "No",
    YoutubeLink: row.YoutubeLink || "",
    Date: row.Date || null,
    TrackId: Number(row.TrackId) || 0,
  });

  const saveAll = async () => {
    if (!selectedSeason || !selectedDivision) {
      alert("Please select Season and Division first.");
      return;
    }

    const creates = rows.filter((r) => !r.Id); // new
    const updates = rows.filter((r, i) => r.Id && JSON.stringify(r) !== JSON.stringify(originalRows[i]));

    if (!creates.length && !updates.length) {
      alert("No changes to save.");
      return;
    }

    setSaving(true);
    const failures = [];

    // POST new races
    for (const row of creates) {
      try {
        if (!row.TrackId) throw new Error("Track required");

        // RaceRequest payload for your POST /api/race
        const payload = {
          Game: row.F1_Game,
          Season: row.Season,
          Division: row.Division,
          Round: row.Round,
          Sprint: row.Sprint || "No",
          TrackId: Number(row.TrackId),
          YoutubeLink: row.YoutubeLink || "",
          Date: row.Date || null,
        };

        const res = await fetch("https://stbleaguedata.vercel.app/api/race", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
      } catch (e) {
        failures.push({ type: "create", row, error: e.message });
      }
    }

    // PUT updates (existing rows)
    for (const row of updates) {
      try {
        if (!row.TrackId) throw new Error("Track required");

        const payload = toUpdatePayload(row);

        const res = await fetch(`https://stbleaguedata.vercel.app/api/race/update/${row.Id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
      } catch (e) {
        failures.push({ type: "update", row, error: e.message });
      }
    }

    setSaving(false);

    if (failures.length) {
      console.error("Some operations failed:", failures);
      alert(`Saved with errors. Success: ${creates.length + updates.length - failures.length}/${creates.length + updates.length}.`);
    } else {
      alert("Season saved successfully!");
      // Refresh originals to the new rows (IDs for new rows would require a refetch if you need them immediately)
      setOriginalRows(rows);
    }
  };

  const revertChanges = () => setRows(originalRows);

  // ----- UI -----
  return (
    <div className="add-season-page">
      <h1>Edit Season</h1>

      {/* Filters card */}
      <div className="card">
        <div className="header-grid">
          <select
            className="select"
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setSelectedDivision("");
            }}
          >
            <option value="">Season…</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                Season {s}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            disabled={!selectedSeason}
          >
            <option value="">Division…</option>
            {Array.from(new Set(allRacesForSeason.map((r) => r.Division)))
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  Division {d}
                </option>
              ))}
          </select>

          <div className="inline-row">
            <span
              className="input"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {rows.length ? `${rows.length} rounds` : "—"}
            </span>
          </div>

          <button
            className="submit-button"
            type="button"
            onClick={saveAll}
            disabled={saving || (changedRows.length === 0)}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>

          <button
            className="button ghost"
            type="button"
            onClick={revertChanges}
            disabled={saving || JSON.stringify(rows) === JSON.stringify(originalRows)}
          >
            Revert Changes
          </button>
        </div>
      </div>

      {/* Table */}
      {selectedSeason && selectedDivision ? (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="season-table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Track</th>
                <th>Sprint</th>
                <th>Race Date</th>
                <th>YouTube</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const changed = originalRows[idx] && JSON.stringify(r) !== JSON.stringify(originalRows[idx]);
                return (
                  <React.Fragment key={r.Id ?? `new-${idx}`}>
                    <tr style={changed ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}>
                      <td>
                        <input
                          className="cell-input"
                          type="number"
                          value={r.Round}
                          onChange={(e) => updateCell(idx, "Round", Number(e.target.value))}
                          min={1}
                        />
                      </td>
                      <td>
                        {tracksLoading ? (
                          <div className="cell-input" style={{ opacity: 0.7 }}>Loading tracks…</div>
                        ) : tracksError ? (
                          <div
                            className="cell-input"
                            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                          >
                            Tracks error
                          </div>
                        ) : (
                          <select
                            className="cell-select"
                            value={r.TrackId || ""}
                            onChange={(e) =>
                              updateCell(
                                idx,
                                "TrackId",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                            required
                          >
                            <option value="">Select Track</option>
                            {tracks
                              .slice()
                              .sort((a, b) => String(a.Name).localeCompare(String(b.Name)))
                              .map((t) => (
                                <option key={t.Id} value={t.Id}>
                                  {t.Name} · {t.Country}
                                </option>
                              ))}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <select
                          className="cell-select"
                          value={r.Sprint || "No"}
                          onChange={(e) => updateCell(idx, "Sprint", e.target.value)}
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="date"
                          value={r.Date || ""}
                          onChange={(e) => updateCell(idx, "Date", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=…"
                          value={r.YoutubeLink || ""}
                          onChange={(e) => updateCell(idx, "YoutubeLink", e.target.value)}
                        />
                      </td>
                    </tr>

                    {/* Inline add divider (appears on hover) */}
                    <tr className="add-divider">
                      <td colSpan={5}>
                        <button
                          type="button"
                          className="add-btn"
                          onClick={() => addRowAfter(idx)}
                          title="Add race below"
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Bottom add button */}
              <tr className="add-bottom">
                <td colSpan={5}>
                  <button type="button" className="button" onClick={addRowAtEnd}>
                    + Add race
                  </button>
                </td>
              </tr>

              {!rows.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "var(--text-dim)" }}>
                    No races found for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="toast" style={{ background: "var(--muted)" }}>
          Select a season and division to load races.
        </div>
      )}

      {/* ===== TeamDrivers Section ===== */}
      {selectedSeason && selectedDivision && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ color: "var(--brand)", marginBottom: 10 }}>Teams & Drivers</h2>

          {loadingTeamDrivers ? (
            <div className="toast">Loading teams and drivers…</div>
          ) : (
            <>
              {teamDrivers.map((td, idx) => (
                <div
                  key={idx}
                  className="team-card"
                  style={{
                    border: "1px dashed var(--border)",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "12px",
                    background: "var(--muted)",
                  }}
                >
                  {/* Select Team */}
                  <select
                    className="select"
                    value={td.TeamId || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTeamDrivers((prev) => {
                        const copy = [...prev];
                        copy[idx].TeamId = val;
                        return copy;
                      });
                    }}
                  >
                    <option value="">Select Team…</option>
                    {teams.map((t) => (
                      <option key={t.Id} value={t.Id}>
                        {t.Name}
                      </option>
                    ))}
                  </select>

                  {/* Driver Inputs */}
                  {(td.Drivers || ["", ""]).map((d, j) => (
                    <input
                      key={j}
                      list="drivers-list"
                      className="input"
                      placeholder="Driver name"
                      value={d}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTeamDrivers((prev) => {
                          const copy = [...prev];
                          if (!copy[idx].Drivers) copy[idx].Drivers = [];
                          copy[idx].Drivers[j] = val;
                          return copy;
                        });
                      }}
                    />
                  ))}

                  {/* Add second driver if missing */}
                  {(!td.Drivers || td.Drivers.length < 2) && (
                    <button
                      type="button"
                      className="button small"
                      onClick={() =>
                        setTeamDrivers((prev) => {
                          const copy = [...prev];
                          if (!copy[idx].Drivers) copy[idx].Drivers = [];
                          copy[idx].Drivers.push("");
                          return copy;
                        })
                      }
                    >
                      + Add Driver
                    </button>
                  )}
                </div>
              ))}

              {/* Add new Team row */}
              <button
                type="button"
                className="button"
                onClick={() =>
                  setTeamDrivers((prev) => [
                    ...prev,
                    {
                      Season: Number(selectedSeason),
                      Division: Number(selectedDivision),
                      TeamId: "",
                      Drivers: [""],
                    },
                  ])
                }
              >
                + Add Team
              </button>

              {/* Driver list datalist */}
              <datalist id="drivers-list">
                {drivers.map((d) => (
                  <option key={d.Id} value={d.Name} />
                ))}
              </datalist>

              {/* Save Assignments */}
              <button
                className="submit-button"
                style={{ marginTop: 16 }}
                disabled={savingTeamDrivers}
                onClick={async () => {
                  setSavingTeamDrivers(true);
                  const errors = [];

                  for (const td of teamDrivers) {
                    if (!td.TeamId) continue;

                    const validDrivers = (td.Drivers || [])
                      .map(d => d?.trim())
                      .filter(Boolean)
                      .slice(0, 2); // max 2 drivers

                    if (validDrivers.length === 0) continue;

                    try {
                      const payload = {
                        Season: Number(selectedSeason),
                        Division: Number(selectedDivision),
                        TeamId: Number(td.TeamId),
                        Drivers: validDrivers, // <-- ARRAY i.p.v. single driver
                      };

                      const res = await fetch(
                        "https://stbleaguedata.vercel.app/api/team/teamdriver", // <-- nieuwe endpoint
                        {
                          method: "POST",
                          headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${localStorage.getItem("token")}`,
                          },
                          body: JSON.stringify(payload),
                        }
                      );

                      if (!res.ok) {
                        const txt = await res.text().catch(() => "");
                        throw new Error(txt || `HTTP ${res.status}`);
                      }
                    } catch (e) {
                      errors.push(`Team ${td.TeamId}: ${e.message}`);
                    }
                  }

                  setSavingTeamDrivers(false);

                  if (errors.length)
                    alert("Some errors occurred:\n" + errors.join("\n"));
                  else alert("Team assignments saved successfully!");
                }}
              >
                {savingTeamDrivers ? "Saving…" : "Save Assignments"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EditSeasonPage;
