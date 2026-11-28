import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./EditRaceResultPage.css";
import "./AddRaceResultPage.css";
import "@/Components/Links.css";
import { API_BASE } from "@/config";

// ---------- points ----------
const MAIN_RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_RACE_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const isSprint = (race) => race?.sprint === "Yes" || race?.Sprint === "Yes";
const pointsFor = (index, row, race, fastest) => {
  if (row.dnf === "Yes") return 0;
  const table = isSprint(race) ? SPRINT_RACE_POINTS : MAIN_RACE_POINTS;
  const base = table[index] || 0;
  const season = Number(race?.season ?? race?.Season);
  const bonus = fastest && index < 10 && !isSprint(race) && season >= 15 && season <= 28 ? 1 : 0;
  return base + bonus;
};

// ---------- race times ("46:48.780" for the winner, "1.165" gaps for the rest, "+1 Lap" etc.) ----------
const FULL = /^\d+:\d{2}\.\d{3}$/;
const GAP = /^\+?\d+\.\d{3}$/;
function toMs(t) {
  const s = String(t || "").trim().replace(/^\+/, "");
  if (FULL.test(s)) {
    const [m, rest] = s.split(":");
    const [sec, ms] = rest.split(".");
    return Number(m) * 60000 + Number(sec) * 1000 + Number(ms);
  }
  if (/^\d+\.\d{3}$/.test(s)) {
    const [sec, ms] = s.split(".");
    return Number(sec) * 1000 + Number(ms);
  }
  return null;
}
const fmtFull = (ms) => {
  const t = Math.max(0, Math.round(ms));
  return `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, "0")}.${String(t % 1000).padStart(3, "0")}`;
};
const fmtGap = (ms) => {
  const t = Math.max(0, Math.round(ms));
  return t >= 60000 ? fmtFull(t) : `${Math.floor(t / 1000)}.${String(t % 1000).padStart(3, "0")}`;
};

/** Absolute race time per row (ms, including penalty) or null when the time is not a time ("+1 Lap", empty). */
function absoluteTimes(rows) {
  const winnerFull = rows.map((r) => String(r.time || "").trim()).find((t) => FULL.test(t));
  const base = winnerFull ? toMs(winnerFull) : 0;
  return rows.map((r) => {
    if (r.dnf === "Yes") return null;
    const raw = String(r.time || "").trim();
    const ms = toMs(raw);
    if (ms === null) return null;
    return (FULL.test(raw) ? ms : base + ms) + (Number(r.penalty) || 0) * 1000;
  });
}

/** Time shown/saved including penalties: leader as full time, others as gap to the (new) leader. */
function adjustedTimes(rows) {
  const abs = absoluteTimes(rows);
  const leader = abs.find((x) => x !== null);
  return rows.map((r, i) => {
    if (abs[i] === null) return String(r.time || "");
    return i === abs.indexOf(leader) ? fmtFull(abs[i]) : fmtGap(abs[i] - leader);
  });
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function readMe() {
  try {
    const tk = localStorage.getItem("token");
    return tk ? jwtDecode(tk) : null;
  } catch {
    return null;
  }
}

export default function EditRaceResults() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const raceId = params.get("race") || "";

  const [races, setRaces] = useState([]); // races that have results
  const [query, setQuery] = useState("");
  const [race, setRace] = useState(null);
  const [original, setOriginal] = useState([]); // rows as loaded
  const [rows, setRows] = useState([]);
  const [fastest, setFastest] = useState(""); // row key with the fastest lap
  const [drivers, setDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [review, setReview] = useState(false);
  const [pendingNew, setPendingNew] = useState(null);
  const [saving, setSaving] = useState(false);

  // ---------- admin only ----------
  useEffect(() => {
    if (readMe()?.role !== "Admin") navigate("/");
  }, [navigate]);

  // ---------- lists ----------
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/race/races`).then((r) => r.json()),
      fetch(`${API_BASE}/api/race/open`).then((r) => r.json()),
    ])
      .then(([all, open]) => {
        const openIds = new Set((Array.isArray(open) ? open : []).map((r) => r.Id));
        const withResults = (Array.isArray(all) ? all : [])
          .filter((r) => !openIds.has(r.Id))
          .sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")) || b.Id - a.Id);
        setRaces(withResults);
      })
      .catch(() => setNotice({ type: "error", text: "Could not load the list of races." }));
    fetch(`${API_BASE}/api/driver`)
      .then((r) => r.json())
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API_BASE}/api/team`)
      .then((r) => r.json())
      .then((d) => setTeams(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, []);

  const driverNames = useMemo(() => new Set(drivers.map((d) => d.Name)), [drivers]);
  const teamNames = useMemo(() => new Set(teams.map((t) => t.Name)), [teams]);

  // ---------- load one race ----------
  const loadRace = useCallback(async (id) => {
    if (!id) {
      setRace(null);
      setRows([]);
      setOriginal([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/race/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { race: r, fastestLap } = await res.json();
      const loaded = [...(r.raceResults || [])]
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
        .map((x) => ({
          key: newKey(),
          id: x.id,
          origPos: x.position,
          driver: x.driver?.name ?? "",
          team: x.team?.name ?? "",
          dnf: x.dnf === "Yes" || x.dnf === "DNF" ? "Yes" : "No",
          qualifying: x.qualifying || "",
          time: x.time ?? "",
          penalty: Number(x.penalty) || 0,
          storedPoints: Number(x.points) || 0,
          storedDnf: x.dnf === "Yes" || x.dnf === "DNF" ? "Yes" : "No",
          storedFastest: !!fastestLap?.driver?.name && x.driver?.name === fastestLap.driver.name,
        }));
      setRace(r);
      setOriginal(loaded);
      setRows(loaded);
      const fl = loaded.find((x) => x.driver && x.driver === fastestLap?.driver?.name);
      setFastest(fl?.key ?? "");
    } catch {
      setNotice({ type: "error", text: "Could not load this race." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRace(raceId);
  }, [raceId, loadRace]);

  // ---------- derived ----------
  const timesAdj = useMemo(() => adjustedTimes(rows), [rows]);
  const fastestIndex = rows.findIndex((r) => r.key === fastest);
  // Unchanged rows keep their stored points (older seasons used other points rules);
  // a row that moved, changed DNF or fastest lap gets points from the table.
  const computed = rows.map((r, i) => ({
    ...r,
    position: i + 1,
    points:
      r.id && r.origPos === i + 1 && r.dnf === r.storedDnf && (i === fastestIndex) === r.storedFastest
        ? r.storedPoints
        : pointsFor(i, r, race, i === fastestIndex),
    timeAdj: timesAdj[i],
    posChange: r.qualifying ? Number(r.qualifying) - (i + 1) : 0,
  }));

  const changes = useMemo(() => {
    const list = [];
    const origByKey = new Map(original.map((o, i) => [o.key, { ...o, pos: i + 1 }]));
    const nowKeys = new Set(rows.map((r) => r.key));
    rows.forEach((r, i) => {
      const o = origByKey.get(r.key);
      const name = r.driver || "(empty row)";
      if (!o) return list.push(`Added ${name} at P${i + 1}`);
      if (o.pos !== i + 1) list.push(`${name}: P${o.pos} → P${i + 1}`);
      if (o.driver !== r.driver) list.push(`P${i + 1}: driver ${o.driver} → ${r.driver}`);
      if (o.team !== r.team) list.push(`${name}: team ${o.team || "–"} → ${r.team || "–"}`);
      if (o.dnf !== r.dnf) list.push(`${name}: ${r.dnf === "Yes" ? "now DNF" : "no longer DNF"}`);
      if (String(o.qualifying) !== String(r.qualifying)) list.push(`${name}: grid ${o.qualifying || "–"} → ${r.qualifying || "–"}`);
      if (String(o.time) !== String(r.time)) list.push(`${name}: time ${o.time || "–"} → ${r.time || "–"}`);
      if ((Number(o.penalty) || 0) !== (Number(r.penalty) || 0)) list.push(`${name}: penalty ${o.penalty || 0}s → ${r.penalty || 0}s`);
    });
    original.forEach((o) => {
      if (!nowKeys.has(o.key)) list.push(`Removed ${o.driver}`);
    });
    return list;
  }, [rows, original]);

  const [loadedFastest, setLoadedFastest] = useState("");
  useEffect(() => {
    if (original.length) setLoadedFastest(fastest);
    // remember the fastest lap as loaded (only when a race is loaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);
  const allChanges = loadedFastest !== fastest
    ? [...changes, `Fastest lap → ${rows.find((r) => r.key === fastest)?.driver || "none"}`]
    : changes;
  const pointChanges = computed
    .filter((r) => r.id && r.points !== r.storedPoints)
    .map((r) => `${r.driver}: ${r.storedPoints} → ${r.points} pts`);
  const dirty = allChanges.length > 0;

  const issues = computed
    .map((r, i) => {
      if (!r.driver.trim()) return { i, reason: "empty driver" };
      if (!driverNames.has(r.driver.trim())) return { i, reason: `${r.driver}: new driver?` };
      if (!teamNames.has(r.team)) return { i, reason: `${r.driver}: ${r.team ? `unknown team "${r.team}"` : "no team"}` };
      return null;
    })
    .filter(Boolean);
  const dupes = new Set(
    rows.map((r) => r.driver.trim().toLowerCase()).filter((n, i, a) => n && a.indexOf(n) !== i)
  );

  // ---------- leaving with unsaved changes ----------
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---------- edits ----------
  const update = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const move = (index, delta) =>
    setRows((rs) => {
      const j = index + delta;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const remove = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    if (fastest === key) setFastest("");
  };
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { key: newKey(), id: null, origPos: null, driver: "", team: "", dnf: "No", qualifying: "", time: "", penalty: 0, storedPoints: 0, storedDnf: "No", storedFastest: false },
    ]);

  // Re-order by race time including penalties: timed finishers first, then the rest (e.g. "+1 Lap"), DNFs last.
  const applyPenalties = () =>
    setRows((rs) => {
      const abs = absoluteTimes(rs);
      const timed = rs.map((r, i) => ({ r, t: abs[i] })).filter((x) => x.t !== null).sort((a, b) => a.t - b.t).map((x) => x.r);
      const untimed = rs.filter((r, i) => abs[i] === null && r.dnf !== "Yes");
      const dnf = rs.filter((r) => r.dnf === "Yes");
      return [...timed, ...untimed, ...dnf];
    });
  const hasPenalties = rows.some((r) => Number(r.penalty));
  const outOfOrder = useMemo(() => {
    const abs = absoluteTimes(rows);
    let last = -1;
    for (const t of abs) {
      if (t === null) continue;
      if (t < last) return true;
      last = t;
    }
    return false;
  }, [rows]);

  const switchRace = (id) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setParams(id ? { race: String(id) } : {});
  };

  // ---------- save ----------
  const save = async (confirmNewDrivers = false) => {
    setSaving(true);
    setNotice(null);
    try {
      const payload = computed.map((r) => ({
        Id: r.id,
        Position: r.position,
        Driver: r.driver.trim(),
        Team: r.team,
        Points: r.points,
        DNF: r.dnf,
        Qualifying: r.qualifying ? parseInt(r.qualifying, 10) : 0,
        Pos_Change: r.posChange,
        FastestLap: r.key === fastest,
        Time: String(r.time || "").trim(),
        Penalty: Number(r.penalty) || 0,
        TimePenalty: r.timeAdj,
      }));
      const res = await fetch(`${API_BASE}/api/race/${race.id}/results`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ results: payload, confirmNewDrivers }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body?.needsConfirmation) {
        setReview(false);
        setPendingNew(body.unknownDrivers || []);
        return;
      }
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`);
      setReview(false);
      setPendingNew(null);
      await loadRace(race.id);
      setNotice({ type: "success", text: body.message || "Saved." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotice({ type: "error", text: `Nothing was saved: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  // ---------- render helpers ----------
  const label = (r) =>
    `${r.Tracks?.RaceName ?? "Race"}${r.Sprint === "Yes" ? " (Sprint)" : ""} · S${r.Season} D${r.Division} R${r.Round}`;
  const shown = races.filter((r) => !query.trim() || label(r).toLowerCase().includes(query.trim().toLowerCase()));
  const recent = races.slice(0, 6);
  const goTo = (i) => {
    const el = document.getElementById(`er-row-${i}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ar-row--flash");
    setTimeout(() => el.classList.remove("ar-row--flash"), 1400);
  };

  return (
    <div className="ar-container er-page">
      <h1>Edit Race Results</h1>

      {/* Race picker */}
      <div className="stb-panel ar-pick">
        <div className="ar-pick__head">
          <h2>Race</h2>
          {race ? (
            <Link to={`/STB/Race/${race.id}`} className="ar-muted er-view">
              View race page ↗
            </Link>
          ) : null}
        </div>
        <div className="ar-todo">
          <span className="ar-todo__label">Latest</span>
          {recent.map((r) => (
            <button
              key={r.Id}
              type="button"
              className={`ar-todo__chip ${String(race?.id) === String(r.Id) ? "is-active" : ""}`}
              onClick={() => switchRace(r.Id)}
            >
              <strong>
                {r.Tracks?.RaceName ?? "Race"}
                {r.Sprint === "Yes" ? " · Sprint" : ""}
              </strong>
              <span>
                S{r.Season} · D{r.Division} · R{r.Round}
              </span>
            </button>
          ))}
        </div>
        <div className="er-search">
          <input type="search" placeholder="Search: track, S31, D2…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={raceId} onChange={(e) => switchRace(e.target.value)}>
            <option value="">{shown.length} races — choose…</option>
            {shown.map((r) => (
              <option key={r.Id} value={r.Id}>
                {label(r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? (
        <div className={`ar-notice ar-notice--${notice.type === "success" ? "info" : notice.type}`} role="status">
          {notice.type === "success" ? "✓ " : ""}
          {notice.text}
          <button type="button" className="ar-notice__close" onClick={() => setNotice(null)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      {loading ? <p className="ar-muted">Loading race…</p> : null}

      {race && !loading ? (
        <>
          <div className="stb-panel er-table-wrap">
            <div className="er-head">
              <h2>
                {race.track?.raceName ?? "Race"}
                {isSprint(race) ? " · Sprint" : ""} <span className="ar-muted">S{race.season} · D{race.division} · R{race.round}</span>
              </h2>
              <div className="er-head__actions">
                {hasPenalties || outOfOrder ? (
                  <button type="button" className="ar-btn ar-btn--ghost" onClick={applyPenalties} title="Sort finishers by race time including penalties">
                    ⏱ Re-order by time {hasPenalties ? "+ penalties" : ""}
                  </button>
                ) : null}
                <button type="button" className="ar-btn ar-btn--ghost" onClick={addRow}>
                  + Add driver
                </button>
              </div>
            </div>
            <p className="ar-muted er-hint">
              Penalty: enter seconds (e.g. 5), then “Re-order by time”. Points follow the position automatically. Use ↑ ↓ to move a driver.
            </p>

            <table className="results-table er-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th />
                  <th>Driver</th>
                  <th>Team</th>
                  <th>DNF</th>
                  <th>Grid</th>
                  <th>Time</th>
                  <th>Penalty (s)</th>
                  <th>Time + pen.</th>
                  <th>FL</th>
                  <th>Pts</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {computed.map((r, i) => {
                  const moved = r.origPos && r.origPos !== r.position ? r.origPos - r.position : 0;
                  const issue = issues.some((x) => x.i === i) || dupes.has(r.driver.trim().toLowerCase());
                  return (
                    <tr key={r.key} id={`er-row-${i}`} className={`${issue ? "ar-row--issue" : ""} ${r.id ? "" : "er-new"}`}>
                      <td className="er-pos">
                        <strong>P{r.position}</strong>
                        {moved ? <span className={moved > 0 ? "er-up" : "er-down"}>{moved > 0 ? `▲${moved}` : `▼${-moved}`}</span> : null}
                      </td>
                      <td className="er-move">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                          ↓
                        </button>
                      </td>
                      <td>
                        <input
                          list="er-drivers"
                          value={r.driver}
                          onChange={(e) => update(r.key, "driver", e.target.value)}
                          className={"ar-driver-input" + (r.driver.trim() ? (driverNames.has(r.driver.trim()) ? " ar-db-ok" : " ar-db-missing") : "")}
                          placeholder="Driver"
                        />
                      </td>
                      <td>
                        <select
                          value={r.team}
                          onChange={(e) => update(r.key, "team", e.target.value)}
                          className={"ar-team-input" + (r.team ? (teamNames.has(r.team) ? " ar-db-ok" : " ar-db-missing") : "")}
                        >
                          <option value="">Team…</option>
                          {r.team && !teamNames.has(r.team) ? <option value={r.team}>{r.team} (unknown)</option> : null}
                          {[...teams]
                            .sort((a, b) => a.Name.localeCompare(b.Name))
                            .map((t) => (
                              <option key={t.Id} value={t.Name}>
                                {t.Name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <select value={r.dnf} onChange={(e) => update(r.key, "dnf", e.target.value)} className="ar-dnf-select">
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </td>
                      <td>
                        <input type="number" min="1" value={r.qualifying} onChange={(e) => update(r.key, "qualifying", e.target.value)} className="er-small" />
                      </td>
                      <td>
                        <input value={r.time} onChange={(e) => update(r.key, "time", e.target.value)} className="ar-time-input" placeholder="1.234" />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={r.penalty || ""}
                          placeholder="0"
                          onChange={(e) => update(r.key, "penalty", Number(e.target.value) || 0)}
                          className={`er-small ${Number(r.penalty) ? "er-pen" : ""}`}
                        />
                      </td>
                      <td className="er-adj">{r.dnf === "Yes" ? "DNF" : r.timeAdj || "–"}</td>
                      <td>
                        <input type="radio" name="fastest" checked={fastest === r.key} onChange={() => setFastest(r.key)} aria-label="Fastest lap" />
                      </td>
                      <td className="er-pts">{r.points}</td>
                      <td>
                        <button type="button" className="er-del" onClick={() => remove(r.key)} aria-label={`Remove ${r.driver}`}>
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id="er-drivers">
              {drivers.map((d) => (
                <option key={d.Id ?? d.Name} value={d.Name} />
              ))}
            </datalist>
            {fastest ? (
              <button type="button" className="er-link" onClick={() => setFastest("")}>
                Clear fastest lap
              </button>
            ) : null}
          </div>

          {/* status bar */}
          <div className="ar-statusbar stb-panel">
            <div className="ar-statusbar__info">
              {dirty ? <strong>{allChanges.length} change{allChanges.length === 1 ? "" : "s"}</strong> : <span className="ar-muted">No changes</span>}
              {issues.length || dupes.size ? (
                <button type="button" className="ar-check" onClick={() => goTo(issues[0]?.i ?? 0)} title={issues.map((x) => x.reason).join("\n")}>
                  ⚠ {issues.length + dupes.size} to check →
                </button>
              ) : null}
              {outOfOrder ? <span className="ar-warn">Times are not in order — use “Re-order by time”?</span> : null}
            </div>
            <div className="er-actions">
              {dirty ? (
                <button type="button" className="ar-btn ar-btn--ghost" onClick={() => loadRace(race.id)} disabled={saving}>
                  Undo all
                </button>
              ) : null}
              <button type="button" className="ar-btn ar-btn--primary ar-save" disabled={!dirty || saving || dupes.size > 0} onClick={() => setReview(true)}>
                Review & save
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* review dialog */}
      {review ? (
        <div className="ar-overlay" onClick={() => setReview(false)}>
          <div className="ar-dialog stb-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Save these changes?</h2>
            <ul className="er-changes">
              {allChanges.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            {pointChanges.length ? (
              <>
                <p className="ar-muted">Points change:</p>
                <ul className="er-changes er-changes--pts">
                  {pointChanges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="ar-muted">Points and time gaps are recalculated from the new order. Everything is saved together — or nothing.</p>
            <div className="ar-dialog__actions">
              <button type="button" className="ar-btn ar-btn--ghost" onClick={() => setReview(false)}>
                Go back
              </button>
              <button type="button" className="ar-btn ar-btn--primary" onClick={() => save(false)} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="ar-dialog__actions">
              <button type="button" className="ar-btn ar-btn--ghost" onClick={() => setPendingNew(null)}>
                Go back
              </button>
              <button type="button" className="ar-btn ar-btn--primary" onClick={() => save(true)} disabled={saving}>
                {saving ? "Saving…" : `Create ${pendingNew.length} and save`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
