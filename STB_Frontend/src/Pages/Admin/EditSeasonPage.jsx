import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
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
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // ----- Load seasons -----
  useEffect(() => {
    fetch("https://stbleague.fly.dev/api/race/seasons")
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
    fetch(`https://stbleague.fly.dev/api/race/races/${selectedSeason}`)
      .then((r) => r.json())
      .then((list) => {
        // normalize + sort by round
        const sorted = (list || []).slice().sort((a, b) => a.round - b.round);
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
      fetch(`https://stbleague.fly.dev/api/team/teamdriver/${selectedSeason}/${selectedDivision}`).then((r) => r.json()),
      fetch(`https://stbleague.fly.dev/api/team`).then((r) => r.json()),
      fetch(`https://stbleague.fly.dev/api/driver/all`).then((r) => r.json()),
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
      .filter((r) => String(r.division) === String(selectedDivision))
      .map((r) => ({
        id: r.id,
        f1_Game: r.f1_Game,
        season: Number(r.season),
        division: Number(r.division),
        round: Number(r.round),
        sprint: r.sprint || "No",
        youtubeLink: r.youtubeLink || "",
        date: r.date ? r.date.split("T")[0] : "",
        // ensure trackId is a number for consistent payloads
        trackId: r.track?.id ?? r.trackId ?? "",
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
        const res = await fetch("https://stbleague.fly.dev/api/track");
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
    id: undefined, // new
    f1_Game: rows[0]?.f1_Game ?? allRacesForSeason[0]?.f1_Game ?? 24,
    season: Number(selectedSeason),
    division: Number(selectedDivision),
    round: afterRound + 1,
    sprint: "No",
    youtubeLink: "",
    date: "",
    trackId: "", // must choose
    ...defaults,
  });

  // Re-number rounds from top to bottom (1..n)
  const renumberRounds = (list) => list.map((r, i) => ({ ...r, round: i + 1 }));

  // Insert a blank row after index i
  const addRowAfter = (i) => {
    setRows((prev) => {
      const copy = [...prev];
      const afterRound = copy[i]?.round ?? copy.length;
      copy.splice(i + 1, 0, makeBlankRow(afterRound));
      return renumberRounds(copy);
    });
  };

  // Append at the end
  const addRowAtEnd = () => {
    setRows((prev) => {
      const afterRound = prev[prev.length - 1]?.round ?? 0;
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
    F1_Game: row.f1_Game,
    Season: row.season,
    Division: row.division,
    Round: row.round,
    Sprint: row.sprint || "No",
    YoutubeLink: row.youtubeLink || "",
    Date: row.date || null,
    TrackId: Number(row.trackId) || 0,
  });

  const saveAll = async () => {
    if (!selectedSeason || !selectedDivision) {
      alert("Please select Season and Division first.");
      return;
    }

    const creates = rows.filter((r) => !r.id); // new
    const updates = rows.filter((r, i) => r.id && JSON.stringify(r) !== JSON.stringify(originalRows[i]));

    if (!creates.length && !updates.length) {
      alert("No changes to save.");
      return;
    }

    setSaving(true);
    const failures = [];

    // POST new races
    for (const row of creates) {
      try {
        if (!row.trackId) throw new Error("Track required");

        // RaceRequest payload for your POST /api/race
        const payload = {
          Game: row.f1_Game,
          Season: row.season,
          Division: row.division,
          Round: row.round,
          Sprint: row.sprint || "No",
          TrackId: Number(row.trackId),
          YoutubeLink: row.youtubeLink || "",
          Date: row.date || null,
        };

        const res = await fetch("https://stbleague.fly.dev/api/race", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        if (!row.trackId) throw new Error("Track required");

        const payload = toUpdatePayload(row);

        const res = await fetch(`https://stbleague.fly.dev/api/race/update/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
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
            {Array.from(new Set(allRacesForSeason.map((r) => r.division)))
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
                  <React.Fragment key={r.id ?? `new-${idx}`}>
                    <tr style={changed ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}>
                      <td>
                        <input
                          className="cell-input"
                          type="number"
                          value={r.round}
                          onChange={(e) => updateCell(idx, "round", Number(e.target.value))}
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
                            value={r.trackId || ""}
                            onChange={(e) =>
                              updateCell(
                                idx,
                                "trackId",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                            required
                          >
                            <option value="">Select Track</option>
                            {tracks
                              .slice()
                              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} · {t.country}
                                </option>
                              ))}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <select
                          className="cell-select"
                          value={r.sprint || "No"}
                          onChange={(e) => updateCell(idx, "sprint", e.target.value)}
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="date"
                          value={r.date || ""}
                          onChange={(e) => updateCell(idx, "date", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=…"
                          value={r.youtubeLink || ""}
                          onChange={(e) => updateCell(idx, "youtubeLink", e.target.value)}
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
                    value={td.teamId || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTeamDrivers((prev) => {
                        const copy = [...prev];
                        copy[idx].teamId = val;
                        return copy;
                      });
                    }}
                  >
                    <option value="">Select Team…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  {/* Driver Inputs */}
                  {(td.drivers || ["", ""]).map((d, j) => (
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
                          if (!copy[idx].drivers) copy[idx].drivers = [];
                          copy[idx].drivers[j] = val;
                          return copy;
                        });
                      }}
                    />
                  ))}

                  {/* Add second driver if missing */}
                  {(!td.drivers || td.drivers.length < 2) && (
                    <button
                      type="button"
                      className="button small"
                      onClick={() =>
                        setTeamDrivers((prev) => {
                          const copy = [...prev];
                          if (!copy[idx].drivers) copy[idx].drivers = [];
                          copy[idx].drivers.push("");
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
                      season: Number(selectedSeason),
                      division: Number(selectedDivision),
                      teamId: "",
                      drivers: [""],
                    },
                  ])
                }
              >
                + Add Team
              </button>

              {/* Driver list datalist */}
              <datalist id="drivers-list">
                {drivers.map((d) => (
                  <option key={d.id} value={d.name} />
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
                    if (!td.teamId) continue;

                    const validDrivers = (td.drivers || [])
                      .map(d => d?.trim())
                      .filter(Boolean)
                      .slice(0, 2); // max 2 drivers

                    if (validDrivers.length === 0) continue;

                    try {
                      const payload = {
                        season: Number(selectedSeason),
                        division: Number(selectedDivision),
                        teamId: Number(td.teamId),
                        drivers: validDrivers, // <-- ARRAY i.p.v. single driver
                      };

                      const res = await fetch(
                        "https://stbleague.fly.dev/api/team/teamdrivers", // <-- nieuwe endpoint
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        }
                      );

                      if (!res.ok) {
                        const txt = await res.text().catch(() => "");
                        throw new Error(txt || `HTTP ${res.status}`);
                      }
                    } catch (e) {
                      errors.push(`Team ${td.teamId}: ${e.message}`);
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
