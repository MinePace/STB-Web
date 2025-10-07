import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./AddRaceResultPage.css";
import "@/Components/Links.css";

// Points Table for Main and Sprint Races
const MAIN_RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SPRINT_RACE_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export default function AddRaceResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillRaceId = searchParams.get("race"); // e.g. ?race=224

  // Races / selection
  const [races, setRaces] = useState([]);
  const [filteredRaces, setFilteredRaces] = useState([]);
  const [existingResults, setExistingResults] = useState(new Set());
  const [selectedRace, setSelectedRace] = useState(null);

  // Rows to submit
  const [raceResults, setRaceResults] = useState([]);

  // Drivers (datalist)
  const [driversList, setDriversList] = useState([]);

  // Teams (dropdown)
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState(null);

  // ---------- Access control ----------
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // ---------- Load all races, then know which already have results ----------
  useEffect(() => {
    fetch("http://localhost:5110/api/race/races")
      .then((res) => res.json())
      .then((allRaces) => {
        setRaces(allRaces || []);
        return fetch("http://localhost:5110/api/race/raceresults")
          .then((res) => res.json())
          .then((allResults) => {
            const withResults = new Set((allResults || []).map((r) => r.raceId));
            setExistingResults(withResults);

            const available = (allRaces || []).filter((r) => !withResults.has(r.id));
            setFilteredRaces(available);

            if (prefillRaceId) {
              const targetId = Number(prefillRaceId);
              const target = available.find((r) => Number(r.id) === targetId);
              if (target) {
                setSelectedRace(target);
                initResultsForRace(target, setRaceResults);
              }
            }
          });
      })
      .catch((err) => console.error("Error fetching races/results:", err));
  }, [prefillRaceId]);

  // ---------- Load drivers ----------
  useEffect(() => {
    fetch("http://localhost:5110/api/driver/all")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDriversList(data);
      })
      .catch((err) => console.error("Error fetching drivers:", err));
  }, []);

  // ---------- Load teams (for dropdown) ----------
  useEffect(() => {
    let abort = false;
    setTeamsLoading(true);
    setTeamsError(null);

    fetch("http://localhost:5110/api/team")
      .then((r) => r.json())
      .then((json) => {
        if (abort) return;
        const arr = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.teams)
          ? json.teams
          : [];
        setTeams(arr);
      })
      .catch((e) => {
        if (!abort) setTeamsError(e.message || "Failed to load teams");
      })
      .finally(() => {
        if (!abort) setTeamsLoading(false);
      });

    return () => {
      abort = true;
    };
  }, []);

  const teamByName = useMemo(() => {
    const m = new Map();
    for (const t of teams) m.set(String(t.name), t);
    return m;
  }, [teams]);

  // ---------- Helpers ----------
  const initResultsForRace = (race, setFn) => {
    const table = race?.sprint === "Yes" ? SPRINT_RACE_POINTS : MAIN_RACE_POINTS;
    setFn(
      Array.from({ length: 20 }, (_, i) => ({
        position: i + 1,
        driver: "",
        team: "",
        teamId: null, // keep FK alongside display name
        points: table[i] || 0,
        dnf: "No",
        pos_Change: 0,
        qualifying: "",
        fastestLap: false,
        raceTime: "",
      }))
    );
  };

  const getNextRaceAfter = (current, remaining) => {
    if (!current) return null;
    const sameSeasonDiv = remaining
      .filter(
        (r) =>
          Number(r.season) === Number(current.season) &&
          String(r.division) === String(current.division) &&
          Number(r.round) > Number(current.round)
      )
      .sort((a, b) => Number(a.round) - Number(b.round));

    if (sameSeasonDiv.length > 0) return sameSeasonDiv[0];

    const resetToFirst = remaining
      .filter(
        (r) =>
          Number(r.season) === Number(current.season) &&
          String(r.division) === String(current.division)
      )
      .sort((a, b) => Number(a.round) - Number(b.round));

    return resetToFirst[0] || null;
  };

  // ---------- UI handlers ----------
  const handleRaceSelect = (e) => {
    const id = e.target.value;
    const race = filteredRaces.find((r) => String(r.id) === id);
    if (!race) return;
    setSelectedRace(race);
    initResultsForRace(race, setRaceResults);
  };

  const handleResultChange = (index, field, value) => {
    setRaceResults((prev) => {
      const updated = [...prev];
      const next = { ...updated[index], [field]: value };

      // if team changed via dropdown or paste, set teamId too
      if (field === "team") {
        const t = teamByName.get(String(value));
        next.teamId = t?.id ?? null;
      }

      // keep pos_Change in sync
      if (field === "position" || field === "qualifying") {
        const q =
          field === "qualifying"
            ? parseInt(value, 10)
            : parseInt(next.qualifying, 10);
        next.pos_Change = Number.isFinite(q) && next.position ? q - next.position : 0;
      }

      // cascading DNF
      if (field === "dnf" && value === "Yes") {
        for (let i = index; i < updated.length; i++) updated[i].dnf = "Yes";
      }

      updated[index] = next;

      // fastest lap recalculation (single true, +1 if main race, pos <= 10, seasons <= 28)
      if (field === "fastestLap") {
        updated.forEach((row, i) => {
          if (i !== index) row.fastestLap = false;
        });

        updated.forEach((row, i) => {
          const base =
            selectedRace?.sprint === "Yes" ? (SPRINT_RACE_POINTS[i] || 0) : (MAIN_RACE_POINTS[i] || 0);
          row.points = base;
          if (
            row.fastestLap === true &&
            row.position <= 10 &&
            selectedRace?.sprint !== "Yes" &&
            Number(selectedRace?.season) <= 28 &&
            Number(selectedRace?.season) >= 15
          ) {
            row.points += 1;
          }
        });
      }

      return updated;
    });
  };

  // column paste (kept, and now also maps team -> teamId)
  const handleColumnPaste = (e, startIndex, field) => {
    const text = e.clipboardData?.getData("text");
    if (!text) return;

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) return; // allow native single-cell paste
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

        if (field === "qualifying") {
          const q = parseInt(row.qualifying, 10);
          row.pos_Change = Number.isFinite(q) ? q - row.position : 0;
        }

        if (field === "team") {
          const t = teamByName.get(String(value));
          row.teamId = t?.id ?? null;
        }

        updated[idx] = row;
      }
      return updated;
    });
  };

  // simple tab navigation (column-wise)
  const handleTabKeyDown = (e, index, type) => {
    if (e.key !== "Tab") return;
    e.preventDefault();

    const isShift = e.shiftKey;
    const cls = `.ar-${type}-input`;
    const inputs = Array.from(document.querySelectorAll(cls));

    if (inputs.length === 0) return;
    const nextIndex = isShift ? (index === 0 ? inputs.length - 1 : index - 1) : (index + 1) % inputs.length;
    inputs[nextIndex].focus();
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!selectedRace) return;

    const payload = raceResults.map((r) => ({
      raceId: selectedRace.id,
      position: r.position,
      driver: r.driver.trim(),
      team: r.team.trim(),
      teamId: r.teamId ?? 0,
      points: r.points,
      dnf: r.dnf,
      qualifying: r.qualifying ? parseInt(r.qualifying, 10) : 0,
      pos_Change: r.pos_Change,
      fastestLap: r.fastestLap,
      Time: r.raceTime.trim(),              // NOTE: capital T — confirm your API expects this
    }));

    const url = "http://localhost:5110/api/race/raceresults";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    try {
      console.log("Submitting results →", { url, payload, selectedRace });

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      const rawBody = await res.text();
      const body = contentType.includes("json")
        ? (() => { try { return JSON.parse(rawBody); } catch { return rawBody; } })()
        : rawBody;

      if (!res.ok) {
        // Show as much detail as possible from the server
        const serverMsg =
          (body && (body.message || body.error || body.title)) || rawBody || "(empty body)";
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${serverMsg}`);
      }

      console.log("Server OK:", body);
      alert(body?.message ?? "Results submitted.");
      // … your “advance to next race” logic here …
    } catch (err) {
      // Network/CORS/abort/JSON errors land here
      console.error("❌ Error submitting results", {
        error: err,
        name: err?.name,
        message: err?.message,
        cause: err?.cause,
      });
      alert(`Failed to submit: ${err?.message || err}`);
    } finally {
      clearTimeout(timer);
    }
  };

  // ---------- Render ----------
  return (
    <div className="ar-container">
      <h1>Add Race Results</h1>

      {/* Race Selection */}
      <div className="race-settings">
        <h2>Select Race</h2>
        <select onChange={handleRaceSelect} required value={selectedRace?.id ?? ""}>
          <option value="">Select a Race</option>
          {filteredRaces.length > 0 ? (
            filteredRaces.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} - Season {r.season}, Round {r.round}, Div {r.division}{" "}
                {r.sprint === "Yes" ? "(Sprint)" : ""}
              </option>
            ))
          ) : (
            <option disabled>No races available</option>
          )}
        </select>
      </div>

      {/* Results Form */}
      <div className="ar-form">
        <h2>Add Results for {selectedRace?.track?.raceName ?? "—"}</h2>
        <p style={{ fontSize: 12, color: "#444951ff" }}>
          Tip: you can paste multiple rows from Excel/Sheets. Focus a cell in Driver, Team, Qualifying or Race Time,
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
              <th>Pos Change</th>
              <th>Fastest Lap</th>
              <th>Race Time</th>
            </tr>
          </thead>
          <tbody>
            {raceResults.map((row, i) => (
              <tr key={i}>
                <td>{row.position}</td>

                <td>
                  <input
                    type="text"
                    list="drivers-list"
                    value={row.driver}
                    onChange={(e) => handleResultChange(i, "driver", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, i, "driver")}
                    onPaste={(e) => handleColumnPaste(e, i, "driver")}
                    placeholder="Select or type driver..."
                    className="ar-driver-input"
                  />
                  <datalist id="drivers-list">
                    {driversList.map((d, idx) => (
                      <option key={idx} value={d} />
                    ))}
                  </datalist>
                </td>

                <td>
                  {teamsLoading ? (
                    <div className="ar-team-input" style={{ opacity: 0.7 }}>Loading teams…</div>
                  ) : teamsError ? (
                    <div className="ar-team-input" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
                      Teams error
                    </div>
                  ) : (
                    <select
                      value={row.team}
                      onChange={(e) => handleResultChange(i, "team", e.target.value)}
                      onKeyDown={(e) => handleTabKeyDown(e, i, "team")}
                      onPaste={(e) => handleColumnPaste(e, i, "team")}
                      className="ar-team-input"
                      required
                    >
                      <option value="">Select team…</option>
                      {teams
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  )}
                </td>

                <td>{row.points}</td>

                <td>
                  <select
                    value={row.dnf}
                    onChange={(e) => handleResultChange(i, "dnf", e.target.value)}
                    className="ar-dnf-select"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>

                <td>
                  <input
                    type="number"
                    value={row.qualifying}
                    onChange={(e) => handleResultChange(i, "qualifying", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, i, "quali")}
                    onPaste={(e) => handleColumnPaste(e, i, "qualifying")}
                    className="ar-quali-input"
                  />
                </td>

                <td>{row.pos_Change}</td>

                <td>
                  <input
                    type="checkbox"
                    checked={row.fastestLap}
                    onChange={(e) => handleResultChange(i, "fastestLap", e.target.checked)}
                  />
                </td>

                <td>
                  <input
                    type="text"
                    value={row.raceTime}
                    onChange={(e) => handleResultChange(i, "raceTime", e.target.value)}
                    onKeyDown={(e) => handleTabKeyDown(e, i, "time")}
                    onPaste={(e) => handleColumnPaste(e, i, "raceTime")}
                    placeholder="Enter race time"
                    className="ar-time-input"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
      <button onClick={handleSubmit} disabled={!selectedRace} className="submit-button">
        Submit All Results
      </button>
    </div>
  );
}
