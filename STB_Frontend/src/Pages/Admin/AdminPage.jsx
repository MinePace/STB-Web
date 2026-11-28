import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./AdminPage.css";
import "@/Components/Links.css";
import { API_BASE } from "@/config";

const fmtDate = (d, withYear = false) => {
  if (!d) return "";
  const date = new Date(String(d).replace(" ", "T"));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear || date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
};
const where = (r) => `S${r.season} · D${r.division} · R${r.round}`;
const raceName = (r) => `${r.track}${r.sprint ? " · Sprint" : ""}`;

function Section({ title, count, children, action, className = "" }) {
  return (
    <section className={`stb-panel ad-card ${className}`}>
      <header className="ad-card__head">
        <h2>
          {title}
          {count !== undefined ? <span className="ad-count">{count}</span> : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [merge, setMerge] = useState(null); // { group, keepId, name, busy, error }
  const [notice, setNotice] = useState(null);

  // Default: keep the name used most recently (then: most races).
  const openMerge = (group) => {
    const keep = [...group].sort((a, b) => (b.lastSeason ?? 0) - (a.lastSeason ?? 0) || b.races - a.races)[0];
    setMerge({ group, keepId: keep.id, name: keep.name, busy: false, error: null });
  };

  const doMerge = async () => {
    const { group, keepId, name } = merge;
    setMerge((m) => ({ ...m, busy: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/drivers/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ keepId, mergeIds: group.map((d) => d.id).filter((id) => id !== keepId), name }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.message || `HTTP ${res.status}`);
      setData((d) => ({
        ...d,
        checks: { ...d.checks, similarDrivers: d.checks.similarDrivers.filter((g) => g !== group) },
      }));
      setNotice(`Merged into “${out.name}” — ${out.movedResults} result${out.movedResults === 1 ? "" : "s"} moved.`);
      setTimeout(() => setNotice(null), 6000);
      setMerge(null);
    } catch (e) {
      setMerge((m) => ({ ...m, busy: false, error: e.message }));
    }
  };

  useEffect(() => {
    let role = null;
    try {
      role = jwtDecode(localStorage.getItem("token") || "").role;
    } catch {
      /* not logged in */
    }
    if (role !== "Admin") {
      navigate("/");
      return;
    }
    fetch(`${API_BASE}/api/admin/overview`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [navigate]);

  const copy = (id) => {
    navigator.clipboard?.writeText(`${window.location.origin}/STB/Race/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="ad-page">
      <header className="ad-hero">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Dashboard</h1>
          {data?.currentSeason ? <p className="ad-muted">Current season: {data.currentSeason}</p> : null}
        </div>
        {/* 6. quick actions */}
        <nav className="ad-actions">
          <Link to="/STB/Add/RaceResults" className="ad-btn ad-btn--primary">
            🏁 Add results
          </Link>
          <Link to="/STB/Edit/RaceResults" className="ad-btn">
            ✏ Edit results / penalties
          </Link>
          <div className="ad-actions__group">
            <span className="ad-muted">Seasons</span>
            <Link to="/STB/Add/Season" className="ad-btn ad-btn--small">
              + Add
            </Link>
            <Link to="/STB/Edit/Season" className="ad-btn ad-btn--small">
              Edit
            </Link>
          </div>
          <div className="ad-actions__group">
            <span className="ad-muted">Tracks</span>
            <Link to="/STB/Add/Track" className="ad-btn ad-btn--small">
              + Add
            </Link>
            <Link to="/STB/Edit/Tracks" className="ad-btn ad-btn--small">
              Edit
            </Link>
          </div>
        </nav>
      </header>

      {error ? <p className="ad-error">Could not load the dashboard: {error}</p> : null}
      {!data && !error ? <p className="ad-muted">Loading…</p> : null}

      {data ? (
        <div className="ad-grid">
          {/* 1. to do */}
          <Section title="To do" count={data.todo.length}>
            {data.todo.length ? (
              <ul className="ad-list">
                {data.todo.map((r) => (
                  <li key={r.id} className="ad-row">
                    <div>
                      <strong>{raceName(r)}</strong>
                      <span className="ad-muted">
                        {where(r)} · {fmtDate(r.date)}
                      </span>
                    </div>
                    <Link to={`/STB/Add/RaceResults?race=${r.id}`} className="ad-btn ad-btn--primary ad-btn--small">
                      Add results
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ad-ok">✓ All races so far have results</p>
            )}
          </Section>

          {/* 2. progress */}
          <Section title="Season progress">
            {data.progress.map((s) => (
              <div key={s.season} className="ad-season">
                <h3>Season {s.season}</h3>
                {s.divisions.map((d) => {
                  const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
                  return (
                    <Link key={d.division} to={`/STB/Championship/${s.season}/${d.division}`} className="ad-progress" title={d.next ? `Next: ${raceName(d.next)} (${fmtDate(d.next.date)})` : "Finished"}>
                      <span className="ad-progress__label">D{d.division}</span>
                      <span className="ad-progress__bar">
                        <span style={{ width: `${pct}%` }} className={pct === 100 ? "is-done" : ""} />
                      </span>
                      <span className="ad-progress__num">
                        {d.done}/{d.total}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </Section>

          {/* 4. recent */}
          <Section title="Last entered">
            <ul className="ad-list">
              {data.recent.map((r) => (
                <li key={r.id} className="ad-row">
                  <div>
                    <strong>{raceName(r)}</strong>
                    <span className="ad-muted">
                      {where(r)} · {fmtDate(r.date)}
                      {r.winner ? ` · 🏆 ${r.winner}` : ""}
                    </span>
                  </div>
                  <div className="ad-row__actions">
                    <Link to={`/STB/Race/${r.id}`} className="ad-btn ad-btn--small">
                      View
                    </Link>
                    <Link to={`/STB/Edit/RaceResults?race=${r.id}`} className="ad-btn ad-btn--small">
                      Edit / penalty
                    </Link>
                    <button type="button" className="ad-btn ad-btn--small" onClick={() => copy(r.id)}>
                      {copied === r.id ? "Copied ✓" : "Copy link"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* 3. upcoming */}
          <Section title="Upcoming races" count={data.upcoming.length || undefined}>
            {data.upcoming.length ? (
              <ul className="ad-list">
                {data.upcoming.map((r) => (
                  <li key={r.id} className="ad-row">
                    <div>
                      <strong>{raceName(r)}</strong>
                      <span className="ad-muted">
                        {where(r)} · {fmtDate(r.date)}
                      </span>
                    </div>
                    <Link to={`/STB/Edit/Season?season=${r.season}&division=${r.division}`} className="ad-btn ad-btn--small">
                      Edit calendar
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ad-muted">No races planned. Add the next season under Seasons → Add.</p>
            )}
          </Section>

          {/* 5. checks */}
          <Section title="Data check" className="ad-wide">
            <div className="ad-checks">
              <div>
                <h3>
                  Possible duplicate drivers <span className="ad-count">{data.checks.similarDrivers.length}</span>
                </h3>
                {data.checks.similarDrivers.length ? (
                  <ul className="ad-list ad-list--compact">
                    {data.checks.similarDrivers.map((g, i) => (
                      <li key={g.map((d) => d.id).join("-")} className="ad-dupes">
                        <span className="ad-dupes__names">
                          {g.map((d, j) => (
                            <span key={d.id}>
                              {j ? <span className="ad-muted"> ↔ </span> : null}
                              <Link to={`/STB/Driver/${encodeURIComponent(d.name)}`}>{d.name}</Link>
                              <span className="ad-muted">
                                {" "}
                                ({d.races}
                                {d.claimed ? ", claimed" : ""})
                              </span>
                            </span>
                          ))}
                        </span>
                        <button type="button" className="ad-btn ad-btn--small" onClick={() => openMerge(g)}>
                          Merge
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ad-ok">✓ None found</p>
                )}
                <p className="ad-muted ad-small">Same name apart from spaces, capitals or a short tag in front (e.g. “STB Maldi” ↔ “Maldi”). Check that it really is the same person before merging.</p>
              </div>
              <div>
                <h3>
                  No YouTube link (S{data.currentSeason}) <span className="ad-count">{data.checks.missingVideo.count}</span>
                </h3>
                {data.checks.missingVideo.count ? (
                  <ul className="ad-list ad-list--compact">
                    {data.checks.missingVideo.races.map((r) => (
                      <li key={r.id}>
                        <Link to={`/STB/Race/${r.id}`}>{raceName(r)}</Link> <span className="ad-muted">{where(r)}</span>
                      </li>
                    ))}
                    {data.checks.missingVideo.count > data.checks.missingVideo.races.length ? (
                      <li className="ad-muted">+{data.checks.missingVideo.count - data.checks.missingVideo.races.length} more</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="ad-ok">✓ Every race has a video</p>
                )}
              </div>
              <div>
                <h3>
                  Old races without results <span className="ad-count">{data.checks.staleRaces.count}</span>
                </h3>
                {data.checks.staleRaces.count ? (
                  <p className="ad-muted">
                    In season {data.checks.staleRaces.seasons.join(", ")}. They are hidden from “To do”; marking them as cancelled comes later.
                  </p>
                ) : (
                  <p className="ad-ok">✓ None</p>
                )}
              </div>
            </div>
          </Section>
        </div>
      ) : null}
      {notice ? <div className="ad-toast" role="status">{notice}</div> : null}

      {merge ? (
        <div className="ar-overlay" onClick={() => !merge.busy && setMerge(null)}>
          <div className="ar-dialog stb-panel ad-merge" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Merge drivers</h2>
            <p className="ad-muted">Pick the driver to keep. All results, fastest laps, team seats and claims of the others move to it; the others are removed.</p>
            <div className="ad-merge__options">
              {merge.group.map((d) => (
                <label key={d.id} className={`ad-merge__opt${merge.keepId === d.id ? " is-on" : ""}`}>
                  <input
                    type="radio"
                    name="keep"
                    checked={merge.keepId === d.id}
                    onChange={() => setMerge((m) => ({ ...m, keepId: d.id, name: d.name }))}
                  />
                  <span className="ad-merge__name">{d.name}</span>
                  <span className="ad-muted">
                    {d.races} races{d.lastSeason ? ` · last S${d.lastSeason}` : ""}
                    {d.claimed ? " · claimed" : ""}
                  </span>
                </label>
              ))}
            </div>
            <label className="ad-merge__field">
              <span>Name after merging</span>
              <input value={merge.name} onChange={(e) => setMerge((m) => ({ ...m, name: e.target.value }))} />
            </label>
            <p className="ad-small">
              Result: <b>{merge.name.trim() || "?"}</b> with {merge.group.reduce((s, d) => s + d.races, 0)} races. This cannot be undone.
            </p>
            {merge.error ? <p className="ad-error">{merge.error}</p> : null}
            <div className="ar-dialog__actions">
              <button type="button" className="ar-btn ar-btn--ghost" onClick={() => setMerge(null)} disabled={merge.busy}>
                Cancel
              </button>
              <button
                type="button"
                className="ar-btn ar-btn--primary"
                onClick={doMerge}
                disabled={merge.busy || !merge.name.trim()}
              >
                {merge.busy ? "Merging…" : `Merge ${merge.group.length} into 1`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
