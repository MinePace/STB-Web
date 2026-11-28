import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./AddRaceResultPage.css";
import "@/Components/Links.css";
import ScreenshotAssist from "./ScreenshotAssist";
import { API_BASE } from "@/config";

// Points Table for Main and Sprint Races
const MAIN_RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SPRINT_RACE_POINTS = [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const isSprint = (race) => race?.Sprint === "Yes";

function recalcPoints(rows, race) {
  return rows.map((row, i) => {
    const base = isSprint(race) ? (SPRINT_RACE_POINTS[i] || 0) : (MAIN_RACE_POINTS[i] || 0);
    const season = Number(race?.Season);
    const bonus =
      row.fastestLap === true && row.position <= 10 && !isSprint(race) && season <= 28 && season >= 15 ? 1 : 0;
    return { ...row, points: base + bonus };
  });
}

export default function AddRaceResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillRaceId = searchParams.get("race"); // e.g. ?race=224

  // Races / selection
  const [filteredRaces, setFilteredRaces] = useState([]); // races without results (from /api/race/open)
  const [racesLoading, setRacesLoading] = useState(true);
  const [notice, setNotice] = useState(null); // { type: "error" | "info", text }
  const [pendingNew, setPendingNew] = useState(null); // unknown drivers waiting for confirmation
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { race, message, next }
  const [existingResults, setExistingResults] = useState(new Set());
  const [selectedRace, setSelectedRace] = useState(null);
  const [teamDriverLinks, setTeamDriverLinks] = useState([]);

  // Rows to submit
  const [raceResults, setRaceResults] = useState([]);
  // Something typed that is not saved yet -> warn before leaving or switching race
  const dirty = !saved && raceResults.some((r) => String(r.driver || "").trim());

  // Cells filled from a screenshot (DNF, qualifying, time, fastest lap): key "row:field" -> "auto"
  const [autoFilled, setAutoFilled] = useState({});

  // Drivers (datalist)
  const [driversList, setDriversList] = useState([]);

  // Teams (dropdown)
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState(null);

  // ---------- Access control ----------
  const token = localStorage.getItem("token");
  
  let role = "user";

  if (token) {
    try {
      const decoded = jwtDecode(token);

      role = decoded.role;
    } catch (e) {
      console.log("JWT decode failed:", e);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Geen token? Meteen terug naar home/login
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const role = decoded.role;

      if (role !== "Admin") {
        navigate("/");
      }
    } catch (e) {
      console.log("JWT decode failed:", e);
      navigate("/");
    }
  }, [navigate]);

  // ---------- Race selection ----------
  const selectRace = useCallback(async (race) => {
    setSelectedRace(race);
    setSaved(null);
    setNotice(null);
    setPendingNew(null);
    if (!race) return;
    initResultsForRace(race, setRaceResults);
    try {
      const res = await fetch(`${API_BASE}/api/team/teamdriver/${race.Season}/${race.Division}`);
      if (!res.ok) throw new Error("Failed to fetch team-driver links");
      setTeamDriverLinks((await res.json()) || []);
    } catch (err) {
      console.error("TeamDriver fetch error:", err);
      setTeamDriverLinks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only races without results, oldest first. Opens on ?race=… or on the first race that is due.
  useEffect(() => {
    setRacesLoading(true);
    fetch(`${API_BASE}/api/race/open`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((open) => {
        const list = Array.isArray(open) ? open : [];
        setFilteredRaces(list);
        const target =
          (prefillRaceId && list.find((r) => Number(r.Id) === Number(prefillRaceId))) ||
          list.find((r) => r.due) ||
          null;
        if (target) selectRace(target);
      })
      .catch((err) => {
        console.error("Error fetching open races:", err);
        setNotice({ type: "error", text: "Could not load the races. Refresh the page to try again." });
      })
      .finally(() => setRacesLoading(false));
  }, [prefillRaceId, selectRace]);

  // ---------- Load drivers ----------
  useEffect(() => {
    fetch(`${API_BASE}/api/driver`)
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

    fetch(`${API_BASE}/api/team`)
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
    for (const t of teams) m.set(String(t.Name), t);
    return m;
  }, [teams]);

  // ---------- Helpers ----------
  const initResultsForRace = (race, setFn) => {
    const table = isSprint(race) ? SPRINT_RACE_POINTS : MAIN_RACE_POINTS;
    setAutoFilled({});
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

  // ---------- UI handlers ----------
  const handleRaceSelect = (e) => {
    const race = filteredRaces.find((r) => String(r.Id) === e.target.value) || null;
    if (dirty && !window.confirm("Discard the results you entered for this race?")) return;
    selectRace(race);
  };

  function formatRaceTimeInput(input) {
    if (!input) return "";

    const str = String(input).trim();

    // Als al geformatteerd of tekst zoals "1 Lap" → laten staan
    if (str.includes(":") || str.includes(".") || /[a-zA-Z]/.test(str)) {
      return str;
    }

    if (!/^\d+$/.test(str)) return str;

    const ms = str.slice(-3).padStart(3, "0");
    const beforeMs = str.slice(0, -3);

    if (!beforeMs) return `0.${ms}`;

    // Laatste 2 cijfers vóór ms = seconden
    const secondsRaw = beforeMs.slice(-2);
    const minutesRaw = beforeMs.slice(0, -2);

    const seconds = Number(secondsRaw);
    const minutes = minutesRaw ? Number(minutesRaw) : 0;

    // Geen minuten tonen als die niet zijn meegegeven
    if (!minutesRaw || minutes === 0) {
      return `${seconds}.${ms}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}.${ms}`;
  }

  const handleResultChange = (index, field, value) => {
    setAutoFilled((prev) => {
      const key = `${index}:${field === "qualifying" ? "qualifying" : field}`;
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRaceResults((prev) => {
      const updated = [...prev];
      const next = { ...updated[index], [field]: value };

      if (field === "driver") {
        const name = String(value).trim().toLowerCase();
        const found = driverTeamMap.get(name);
        if (found) {
          next.team = found.teamName;
          next.teamId = found.teamId;
        }
      }

      // if team changed via dropdown or paste, set teamId too
      if (field === "team") {
        const t = teamByName.get(String(value));
        next.teamId = t?.Id ?? null;
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
        return recalcPoints(updated, selectedRace);
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

        if (field === "driver") {
          const name = String(value).trim().toLowerCase();
          const found = driverTeamMap.get(name);
          if (found) {
            row.team = found.teamName;
            row.teamId = found.teamId;
          }
        }

        if (field === "qualifying") {
          const q = parseInt(row.qualifying, 10);
          row.pos_Change = Number.isFinite(q) ? q - row.position : 0;
        }

        if (field === "team") {
          const t = teamByName.get(String(value));
          row.teamId = t?.Id ?? null;
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
  const handleSubmit = async (confirmNew = false) => {
    if (!selectedRace || saving) return;

    const payload = raceResults.map((r) => ({
      RaceId: selectedRace.Id,
      Position: r.position,
      Driver: r.driver.trim(),
      Team: r.team.trim(),
      TeamId: r.teamId ?? 0,
      Points: r.points,
      DNF: r.dnf,
      Qualifying: r.qualifying ? parseInt(r.qualifying, 10) : 0,
      Pos_Change: r.pos_Change,
      FastestLap: r.fastestLap,
      Time: r.raceTime.trim(),
      TimePenalty: r.raceTime.trim()
    }))

    const url = `${API_BASE}/api/race/raceresult`;
    const token = localStorage.getItem("token");

    // Saved "all or nothing" by the API. Unknown drivers are only created after confirmation.
    const send = async (confirmNewDrivers) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ results: payload, confirmNewDrivers }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => ({}));
        return { res, body };
      } finally {
        clearTimeout(timer);
      }
    };

    setNotice(null);
    setSaving(true);
    try {
      let { res, body } = await send(confirmNew);

      if (res.status === 409 && body?.needsConfirmation) {
        // Ask in the page (not a browser pop-up); nothing is saved yet.
        setPendingNew(body.unknownDrivers || []);
        return;
      }
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);

      setPendingNew(null);
      const remaining = filteredRaces.filter((r) => r.Id !== selectedRace.Id);
      setFilteredRaces(remaining);
      setSaved({
        race: selectedRace,
        message: body?.message ?? "Results saved.",
        next: remaining.find((r) => r.due) || null,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error submitting results", err);
      setNotice({
        type: "error",
        text: `Nothing was saved: ${err?.name === "AbortError" ? "the server did not respond in time" : err?.message || err}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const driverTeamMap = useMemo(() => {
    const map = new Map();
    teamDriverLinks.forEach((t) => {
      (t.Drivers || []).forEach((driverName) => {
        map.set(driverName.toLowerCase().trim(), {
          teamId: t.TeamId,
          teamName: t.TeamName,
        });
      });
    });
    return map;
  }, [teamDriverLinks]);

  // ---------- Screenshot auto-fill ----------
  const seasonDriverNames = useMemo(
    () => teamDriverLinks.flatMap((t) => t.Drivers || []),
    [teamDriverLinks]
  );
  const allDriverNames = useMemo(() => driversList.map((d) => d.Name).filter(Boolean), [driversList]);
  const teamNames = useMemo(() => teams.map((t) => t.Name).filter(Boolean), [teams]);

  const applyScreenshot = ({ rows, fastestLapPosition }) => {
    const marks = {};
    const updated = raceResults.map((r) => ({ ...r }));
    for (const r of rows) {
      const i = r.position - 1;
      if (i < 0 || i >= updated.length) continue;
      const row = updated[i];

      // Driver and team: database name when found, otherwise the text from the screenshot.
      // Their colour (green/red) comes from the database check below, not from these marks.
      if (r.driver) row.driver = r.driver;
      const linked = r.driverFound ? driverTeamMap.get(r.driver.toLowerCase().trim()) : null;
      const teamName = linked?.teamName ?? r.team;
      if (teamName) {
        row.team = teamName;
        row.teamId = linked?.teamId ?? teamByName.get(teamName)?.Id ?? null;
      }

      if (r.raceTime) {
        row.raceTime = r.raceTime;
        marks[`${i}:raceTime`] = "auto";
      }
      row.dnf = r.dnf ? "Yes" : "No";
      marks[`${i}:dnf`] = "auto";
      if (r.grid) {
        row.qualifying = r.grid;
        row.pos_Change = r.grid - row.position;
        marks[`${i}:qualifying`] = "auto";
      }
    }
    if (fastestLapPosition) {
      updated.forEach((row) => (row.fastestLap = row.position === fastestLapPosition));
      marks[`${fastestLapPosition - 1}:fastestLap`] = "auto";
    }
    setRaceResults(recalcPoints(updated, selectedRace));
    setAutoFilled(marks);
  };

  // Green = exists in the database, red = not found (saving creates a new driver / fails for a team).
  const driverNames = useMemo(() => new Set(driversList.map((d) => d.Name)), [driversList]);
  const dbClass = (value, known) => {
    const v = String(value || "");
    if (!v.trim()) return "";
    return known ? " ar-db-ok" : " ar-db-missing";
  };

  const autoClass = (i, field) => (autoFilled[`${i}:${field}`] ? " ar-auto" : "");

  // ---------- Leaving with unsaved results ----------
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---------- What still needs checking ----------
  const status = useMemo(() => {
    const filled = raceResults.filter((r) => String(r.driver || "").trim());
    const seen = new Map();
    const issues = []; // { index, reason }
    raceResults.forEach((r, i) => {
      const d = String(r.driver || "").trim();
      if (!d) return;
      const key = d.toLowerCase();
      if (seen.has(key)) issues.push({ index: i, reason: `${d} is listed twice` });
      seen.set(key, i);
      if (!driverNames.has(d)) issues.push({ index: i, reason: `${d}: new driver?` });
      if (!r.team) issues.push({ index: i, reason: `${d}: no team` });
      else if (!teamByName.has(r.team)) issues.push({ index: i, reason: `${d}: unknown team "${r.team}"` });
    });
    const autoRows = new Set(Object.keys(autoFilled).map((k) => Number(k.split(":")[0]))).size;
    const fastest = raceResults.filter((r) => r.fastestLap).length;
    return { filled: filled.length, issues, autoRows, fastest };
  }, [raceResults, driverNames, teamByName, autoFilled]);

  const goToRow = (index) => {
    const row = document.getElementById(`ar-row-${index}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ar-row--flash");
    setTimeout(() => row.classList.remove("ar-row--flash"), 1400);
    row.querySelector("input, select")?.focus({ preventScroll: true });
  };
  const issueRows = [...new Set(status.issues.map((x) => x.index))];

  const raceLabel = (r) =>
    `${r.Tracks?.RaceName ?? r.Name ?? "Race"}${r.Sprint === "Yes" ? " (Sprint)" : ""} · S${r.Season} D${r.Division} R${r.Round}`;
  const fmtDate = (d) =>
    d ? new Date(String(d).replace(" ", "T")).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
  const dueRaces = filteredRaces.filter((r) => r.due);

  // ---------- Render ----------
  return (
    <div className="ar-container">
      <h1>Add Race Results</h1>

      {/* Saved: next steps */}
      {saved ? (
        <div className="ar-saved stb-panel" role="status">
          <div>
            <span className="eyebrow">Saved ✓</span>
            <h2>{raceLabel(saved.race)}</h2>
            <p className="ar-muted">{saved.message}</p>
          </div>
          <div className="ar-saved__actions">
            <Link to={`/STB/Race/${saved.race.Id}`} className="ar-btn ar-btn--ghost">
              View race
            </Link>
            <button
              type="button"
              className="ar-btn ar-btn--ghost"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/STB/Race/${saved.race.Id}`);
                setNotice({ type: "info", text: "Link copied — paste it in Discord for the preview." });
              }}
            >
              Copy link
            </button>
            {saved.next ? (
              <button type="button" className="ar-btn ar-btn--primary" onClick={() => { selectRace(saved.next); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                Next: {raceLabel(saved.next)} →
              </button>
            ) : (
              <span className="ar-muted">All races that are due have results 🎉</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Race Selection */}
      <div className="race-settings stb-panel ar-pick">
        <div className="ar-pick__head">
          <h2>Race</h2>
          {racesLoading ? <span className="ar-muted">Loading races…</span> : null}
        </div>
        {dueRaces.length ? (
          <div className="ar-todo">
            <span className="ar-todo__label">To do ({dueRaces.length})</span>
            {dueRaces.slice(0, 8).map((r) => (
              <button
                key={r.Id}
                type="button"
                className={`ar-todo__chip ${selectedRace?.Id === r.Id ? "is-active" : ""}`}
                onClick={() => {
                  if (selectedRace?.Id === r.Id) return;
                  if (dirty && !window.confirm("Discard the results you entered for this race?")) return;
                  selectRace(r);
                }}
              >
                <strong>{r.Tracks?.RaceName ?? r.Name}{r.Sprint === "Yes" ? " · Sprint" : ""}</strong>
                <span>S{r.Season} · D{r.Division} · R{r.Round} · {fmtDate(r.Date)}</span>
              </button>
            ))}
            {dueRaces.length > 8 ? <span className="ar-muted">+{dueRaces.length - 8} more in the list below</span> : null}
          </div>
        ) : !racesLoading ? (
          <p className="ar-muted">No races waiting for results. Pick an upcoming race below if needed.</p>
        ) : null}
        <select onChange={handleRaceSelect} required value={selectedRace?.Id ?? ""}>
          <option value="">Other race…</option>
          {filteredRaces.map((r) => (
            <option key={r.Id} value={r.Id}>
              {r.due ? "● " : ""}
              {raceLabel(r)} — {fmtDate(r.Date)}
            </option>
          ))}
        </select>
      </div>

      <ScreenshotAssist
        disabled={!selectedRace}
        seasonDrivers={seasonDriverNames}
        allDrivers={allDriverNames}
        teams={teamNames}
        onApply={applyScreenshot}
      />

      {/* Results Form */}
      <div className="ar-form">
        <h2>Add Results for {selectedRace?.Tracks?.RaceName ?? "—"}</h2>
        <p style={{ fontSize: 12, color: "#8a909aff" }}>
          Tip: you can paste multiple rows from Excel/Sheets. Focus a cell in Driver, Team, Qualifying or Race Time,
          then paste — it fills down from the focused row.
        </p>

        <div className="ar-legend">
          <span><i className="ar-db-ok" /> Driver / team found in the database</span>
          <span><i className="ar-db-missing" /> Not found — check spelling (a new driver is created on save; an unknown team cannot be saved)</span>
          <span><i className="ar-auto" /> Filled in from the screenshot — check against the screenshot</span>
        </div>

        <table className="results-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Points</th>
              <th>DNF</th>
              <th>Qualifying</th>
              <th>Fastest Lap</th>
              <th>Race Time</th>
            </tr>
          </thead>
          <tbody>
            {raceResults.map((row, i) => (
              <tr key={i} id={`ar-row-${i}`} className={issueRows.includes(i) ? "ar-row--issue" : ""}>
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
                    className={"ar-driver-input" + dbClass(row.driver, driverNames.has(row.driver))}
                  />
                  <datalist id="drivers-list">
                    {driversList.map((d, idx) => (
                      <option key={idx} value={d.Name} />
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
                      className={"ar-team-input" + dbClass(row.team, teamByName.has(row.team))}
                      required
                    >
                      <option value="">Select team…</option>
                      {row.team && !teamByName.has(row.team) && (
                        <option value={row.team}>{row.team} (not in database)</option>
                      )}
                      {teams
                        .slice()
                        .sort((a, b) => a.Name.localeCompare(b.Name))
                        .map((t) => (
                          <option key={t.Id} value={t.Name}>
                            {t.Name}
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
                    className={"ar-dnf-select" + autoClass(i, "dnf")}
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
                    className={"ar-quali-input" + autoClass(i, "qualifying")}
                  />
                </td>

                <td className={autoClass(i, "fastestLap").trim()}>
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
                    onBlur={(e) => {
                      const formatted = formatRaceTimeInput(e.target.value);
                      handleResultChange(i, "raceTime", formatted);
                    }}
                    placeholder="Enter race time"
                    className={"ar-time-input" + autoClass(i, "raceTime")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status + save (sticky at the bottom) */}
      {selectedRace && !saved ? (
        <div className="ar-statusbar stb-panel">
          <div className="ar-statusbar__info">
            <strong>{status.filled} drivers</strong>
            {status.issues.length ? (
              <button type="button" className="ar-check" onClick={() => goToRow(issueRows[0])} title={status.issues.map((x) => x.reason).join("\n")}>
                ⚠ {issueRows.length} {issueRows.length === 1 ? "row" : "rows"} to check →
              </button>
            ) : status.filled ? (
              <span className="ar-ok">✓ All drivers and teams recognised</span>
            ) : (
              <span className="ar-muted">Paste a screenshot or type the results</span>
            )}
            {status.autoRows ? <span className="ar-muted">{status.autoRows} rows from screenshot</span> : null}
            {status.filled && status.fastest !== 1 ? <span className="ar-warn">Fastest lap: {status.fastest === 0 ? "none ticked" : `${status.fastest} ticked`}</span> : null}
          </div>
          <button onClick={() => handleSubmit(false)} disabled={!status.filled || saving} className="ar-btn ar-btn--primary ar-save">
            {saving ? "Saving…" : "Save results"}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className={`ar-notice ar-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.text}
          <button type="button" className="ar-notice__close" onClick={() => setNotice(null)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      {/* New drivers: confirm in the page */}
      {pendingNew ? (
        <div className="ar-overlay" onClick={() => setPendingNew(null)}>
          <div className="ar-dialog stb-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>New drivers</h2>
            <p>These drivers are not in the database yet:</p>
            <ul>
              {pendingNew.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="ar-muted">Create them and save the results? Choose “Go back” to fix the spelling first — nothing is saved yet.</p>
            <div className="ar-dialog__actions">
              <button type="button" className="ar-btn ar-btn--ghost" onClick={() => setPendingNew(null)}>
                Go back
              </button>
              <button type="button" className="ar-btn ar-btn--primary" onClick={() => handleSubmit(true)} disabled={saving}>
                {saving ? "Saving…" : `Create ${pendingNew.length} and save`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
