import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { jwtDecode } from "jwt-decode";
import "./DriverPage.css";
import "@/Components/Links.css";

import DriverLoader from "@/Components/Loaders/DriverLoader";
import usePageMeta from "@/usePageMeta";
import { API_BASE } from "@/config";
import { teamColor } from "@/teams";

// ---------- helpers ----------
const raceHref = (id) => `/STB/Race/${id}`;
const driverHref = (name) => `/STB/Driver/${encodeURIComponent(name)}`;
const champHref = (s, d) => `/STB/Championship/${s}/${d}`;

function readMe() {
  try {
    const tk = localStorage.getItem("token");
    return tk ? jwtDecode(tk) : null;
  } catch {
    return null;
  }
}
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

function PosBadge({ pos, dnf }) {
  if (dnf) return <span className="pos-badge pos-badge--dnf">DNF</span>;
  if (!pos) return <span className="pos-badge dp-pos--plain">–</span>;
  return <span className={`pos-badge ${pos <= 3 ? `pos-badge--p${pos}` : "dp-pos--plain"}`}>P{pos}</span>;
}

function TeamTag({ team }) {
  if (!team) return null;
  return (
    <span className="dp-team">
      <span className="dp-team__bar" style={{ background: teamColor(team) }} />
      {team}
    </span>
  );
}

// ---------- sections ----------
function Hero({ data, me, myClaim, onClaim, onEditCountry, t }) {
  const { driver, career, current } = data;
  const canEdit = me && (me.role === "Admin" || Number(driver.userId) === Number(me.id));
  const canClaim = me && !driver.claimedBy && !myClaim;
  return (
    <header className="dp-hero stb-panel racing-stripes">
      <div className="dp-hero__main">
        <span className="eyebrow">
          {t("driverPage.eyebrow")}
          {driver.country ? ` · ${t(`countries.${driver.country}`, driver.country)}` : ""}
        </span>
        <div className="dp-hero__name-row">
          {driver.country ? <img className="dp-hero__flag" src={`/flags/${driver.country}.png`} alt={driver.country} /> : null}
          <h1 className="dp-hero__name">{driver.name}</h1>
        </div>
        <div className="dp-hero__chips">
          {current?.team ? <TeamTag team={current.team} /> : null}
          {career.firstSeason ? <span className="dp-chip">{t("driverPage.activeSince", { n: career.firstSeason })}</span> : null}
          {career.seasons ? <span className="dp-chip">{t("driverPage.seasonsCount", { count: career.seasons })}</span> : null}
          {data.titles.length ? (
            <span className="dp-chip dp-chip--gold">🏆 {t("driverPage.titlesCount", { count: data.titles.length })}</span>
          ) : null}
        </div>
      </div>
      <div className="dp-hero__side">
        <span className={`dp-claim ${driver.claimedBy ? "" : "dp-claim--open"}`}>
          {driver.claimedBy ? t("driverPage.claimedBy", { name: driver.claimedBy }) : t("driverPage.unclaimed")}
        </span>
        {canClaim ? (
          <button className="btn-primary dp-btn" onClick={onClaim}>
            {t("driverPage.claim")}
          </button>
        ) : null}
        {canEdit ? (
          <button className="dp-btn dp-btn--ghost" onClick={onEditCountry}>
            🌍 {t("driverPage.changeCountry")}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function CareerTiles({ career, t, lang }) {
  const n = (v, d = 0) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(lang, { maximumFractionDigits: d, minimumFractionDigits: d }));
  const tiles = [
    ["races", n(career.races)],
    ["wins", n(career.wins)],
    ["podiums", n(career.podiums)],
    ["poles", n(career.poles)],
    ["fastestLaps", n(career.fastestLaps)],
    ["titles", n(career.titles)],
    ["points", n(career.points)],
    ["winRate", career.races ? `${Math.round(career.winRate * 100)}%` : "–"],
    ["avgFinish", n(career.avgFinish, 1)],
    ["avgGrid", n(career.avgGrid, 1)],
    ["dnfs", n(career.dnfs)],
    ["bestFinish", career.bestFinish ? `P${career.bestFinish}` : "–", career.bestFinishCount > 1 ? `${career.bestFinishCount}×` : null],
  ];
  return (
    <section>
      <h2 className="dp-section-title">{t("driverPage.career")}</h2>
      <div className="dp-tiles">
        {tiles.map(([key, value, sub]) => (
          <div key={key} className="stb-panel dp-tile">
            <span className="dp-tile__value">
              {value}
              {sub ? <small> {sub}</small> : null}
            </span>
            <span className="dp-tile__label">{t(`driverPage.tiles.${key}`)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LastRace({ race, fmtDate, t }) {
  if (!race) return null;
  const top = race.results.slice(0, 3);
  const meRow = race.results.find((r) => r.me);
  const rows = meRow && !top.includes(meRow) ? [...top, null, meRow] : top;
  return (
    <article className="stb-panel dp-panel">
      <header className="dp-panel__head">
        <h2 className="dp-section-title">{t("driverPage.lastRace")}</h2>
        <span className="dp-muted">{fmtDate(race.date)}</span>
      </header>
      <Link to={raceHref(race.id)} className="dp-lastrace__title">
        {race.track}
        {race.sprint ? ` · ${t("driverPage.sprint")}` : ""}
      </Link>
      <Link to={champHref(race.season, race.division)} className="dp-muted dp-link">
        {t("driverPage.where", { s: race.season, d: race.division, r: race.round })}
      </Link>
      <ol className="dp-mini-results">
        {rows.map((r, i) =>
          r === null ? (
            <li key={`gap-${i}`} className="dp-mini-results__gap" aria-hidden>
              ⋯
            </li>
          ) : (
            <li key={`${r.name}-${i}`} className={r.me ? "is-me" : ""}>
              <PosBadge pos={r.pos} dnf={r.dnf} />
              <Link to={driverHref(r.name)} className="dp-mini-results__name">
                {r.name}
              </Link>
              <TeamTag team={r.team} />
              <span className="dp-mini-results__pts">{r.points} {t("driverPage.pts")}</span>
            </li>
          )
        )}
      </ol>
    </article>
  );
}

function RecentRaces({ races, t }) {
  const recent = races.slice(0, 5);
  return (
    <article className="stb-panel dp-panel">
      <header className="dp-panel__head">
        <h2 className="dp-section-title">{t("driverPage.recent")}</h2>
      </header>
      {recent.length ? (
        <ul className="dp-recent">
          {recent.map((r) => (
            <li key={r.id}>
              <Link to={raceHref(r.id)} className="dp-recent__row">
                <PosBadge pos={r.pos} dnf={r.dnf} />
                <span className="dp-recent__track">
                  {r.track}
                  {r.sprint ? <span className="dp-tag">{t("driverPage.sprint")}</span> : null}
                  {r.fastestLap ? (
                    <span className="dp-tag dp-tag--fl" title={t("driverPage.fastestLap")}>
                      ⏱
                    </span>
                  ) : null}
                  <span className="dp-muted dp-recent__where">{t("driverPage.where", { s: r.season, d: r.division, r: r.round })}</span>
                </span>
                <span className="dp-recent__pts">
                  {r.points} {t("driverPage.pts")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dp-muted">{t("driverPage.noRaces")}</p>
      )}
    </article>
  );
}

function SeasonsTable({ seasons, t }) {
  if (!seasons.length) return null;
  return (
    <section className="stb-panel dp-panel">
      <h2 className="dp-section-title">{t("driverPage.seasons")}</h2>
      <div className="dp-table-wrap">
        <table className="dp-table">
          <thead>
            <tr>
              <th>{t("driverPage.cols.season")}</th>
              <th>{t("driverPage.cols.division")}</th>
              <th>{t("driverPage.cols.team")}</th>
              <th className="num">{t("driverPage.cols.races")}</th>
              <th className="num">{t("driverPage.cols.wins")}</th>
              <th className="num">{t("driverPage.cols.podiums")}</th>
              <th className="num">{t("driverPage.cols.points")}</th>
              <th className="num">{t("driverPage.cols.position")}</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={`${s.season}-${s.division}`} className={s.champion ? "is-champion" : ""}>
                <td>
                  <Link to={champHref(s.season, s.division)} className="dp-link">
                    S{s.season}
                  </Link>
                </td>
                <td>D{s.division}</td>
                <td>
                  <TeamTag team={s.team} />
                  {s.teams.length > 1 ? <span className="dp-muted"> +{s.teams.length - 1}</span> : null}
                </td>
                <td className="num">{s.races}</td>
                <td className="num">{s.wins}</td>
                <td className="num">{s.podiums}</td>
                <td className="num">{s.points}</td>
                <td className="num">
                  {s.position ? (
                    <>
                      <PosBadge pos={s.position} />
                      <span className="dp-muted dp-of"> / {s.of}</span>
                      {s.champion ? <span title={t("driverPage.champion")}> 🏆</span> : null}
                      {!s.finished ? <span className="dp-tag">{t("driverPage.ongoing")}</span> : null}
                    </>
                  ) : (
                    "–"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Start vs finish: rows = starting position, columns = finishing position (finished races only).
function StartFinishHeatmap({ races, t }) {
  const [selected, setSelected] = useState(null);
  const wrapRef = useRef(null);
  const SIZE = 20;

  const matrix = useMemo(() => {
    const m = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => []));
    for (const r of races) {
      if (r.dnf || !r.grid || !r.pos || r.grid > SIZE || r.pos > SIZE) continue;
      m[r.grid - 1][r.pos - 1].push(r);
    }
    return m;
  }, [races]);
  const max = Math.max(1, ...matrix.flat().map((c) => c.length));

  useEffect(() => {
    if (!selected) return;
    const close = (e) => {
      if (!wrapRef.current?.contains(e.target)) setSelected(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [selected]);

  return (
    <div className="dp-heat" ref={wrapRef}>
      <div className="dp-heat__legend">
        <span>{t("driver.graphs.less")}</span>
        <span className="dp-heat__scale" />
        <span>{t("driver.graphs.more")}</span>
      </div>
      <div className="dp-heat__axis-x">{t("driverPage.finish")} →</div>
      <div className="dp-heat__grid">
        <span />
        {Array.from({ length: SIZE }, (_, i) => (
          <span key={`c${i}`} className="dp-heat__label">
            {i + 1}
          </span>
        ))}
        {matrix.map((row, r) => (
          <div key={`r${r}`} className="dp-heat__row">
            <span className="dp-heat__label">{r + 1}</span>
            {row.map((cell, c) => {
              const count = cell.length;
              const active = selected && selected.start === r + 1 && selected.finish === c + 1;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`dp-heat__cell ${r === c ? "is-diag" : ""} ${active ? "is-active" : ""}`}
                  style={count ? { background: `rgba(26, 163, 255, ${0.18 + 0.82 * (count / max)})` } : undefined}
                  title={`P${r + 1} → P${c + 1}: ${count}`}
                  disabled={!count}
                  onClick={() => setSelected(active ? null : { start: r + 1, finish: c + 1, races: cell })}
                >
                  {count || ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="dp-heat__axis-y">↓ {t("driverPage.start")}</div>
      {selected ? (
        <div className="dp-heat__flyout stb-panel">
          <strong>
            P{selected.start} → P{selected.finish}
          </strong>
          <ul>
            {selected.races.map((r) => (
              <li key={r.id}>
                <Link to={raceHref(r.id)} className="dp-link">
                  {r.track} · S{r.season} D{r.division}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="dp-muted dp-small">{t("driver.graphs.subtitle")}</p>
    </div>
  );
}

function ResultsBreakdown({ races, t }) {
  const podiums = races.filter((r) => !r.dnf && r.pos && r.pos <= 3).length;
  const points = races.filter((r) => !r.dnf && r.points > 0 && !(r.pos && r.pos <= 3)).length;
  const dnf = races.filter((r) => r.dnf).length;
  const noPoints = races.length - podiums - points - dnf;
  const data = [
    ["podiums", podiums, "var(--gold)"],
    ["points", points, "var(--primary)"],
    ["noPoints", noPoints, "rgba(169, 187, 220, 0.45)"],
    ["dnf", dnf, "var(--danger)"],
  ];
  let acc = 0;
  const total = races.length || 1;
  const stops = data
    .map(([, v, c]) => {
      const a = (acc / total) * 360;
      acc += v;
      return `${c} ${a}deg ${(acc / total) * 360}deg`;
    })
    .join(", ");
  return (
    <div className="dp-donut">
      <div className="dp-donut__ring" style={{ background: `conic-gradient(${stops})` }}>
        <div className="dp-donut__hole">
          <strong>{races.length}</strong>
          <span>{t("driverPage.tiles.races")}</span>
        </div>
      </div>
      <ul className="dp-donut__legend">
        {data.map(([key, v, c]) => (
          <li key={key}>
            <span className="dp-donut__dot" style={{ background: c }} />
            {t(`driverPage.breakdown.${key}`)}
            <strong>{v}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PointsFinishes({ races, t }) {
  const counts = Array.from({ length: 10 }, (_, i) => races.filter((r) => !r.dnf && r.pos === i + 1).length);
  const max = Math.max(1, ...counts);
  if (!counts.some(Boolean)) return <p className="dp-muted">{t("driverPage.noPointsFinishes")}</p>;
  return (
    <div className="dp-bars">
      {counts.map((c, i) => (
        <div key={i} className="dp-bars__col" title={`P${i + 1}: ${c}`}>
          <span className="dp-bars__count">{c || ""}</span>
          <span
            className={`dp-bars__bar ${i < 3 ? `dp-bars__bar--p${i + 1}` : ""}`}
            style={{ height: `${(c / max) * 100}%` }}
          />
          <span className="dp-bars__label">P{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

// Form: finishing position in the last 10 races (oldest left, newest right).
function FormChart({ races, t }) {
  const last = races.slice(0, 10).reverse();
  if (!last.length) return <p className="dp-muted">{t("driverPage.noRaces")}</p>;
  const W = 320, H = 170, padL = 30, padR = 44, padT = 14, padB = 24;
  const finished = last.filter((r) => !r.dnf && r.pos);
  // fixed scale so drivers can be compared; extends only for fields bigger than 20
  const worst = Math.max(20, ...last.map((r) => r.pos || 0));
  const y = (pos) => padT + ((pos - 1) / (worst - 1)) * (H - padT - padB);
  const x = (i) => padL + (last.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (last.length - 1));
  const avg = finished.length ? finished.reduce((s, r) => s + r.pos, 0) / finished.length : null;
  // line through finished races only; DNFs break nothing but are drawn as red dots on the bottom edge
  const path = last
    .map((r, i) => (r.dnf || !r.pos ? null : `${x(i).toFixed(1)},${y(r.pos).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const ticks = [1, 5, 10, 15, 20].filter((p) => p <= worst);
  return (
    <div className="dp-form">
      <svg viewBox={`0 0 ${W} ${H}`} className="dp-form__svg" role="img" aria-label={t("driverPage.form")}>
        {ticks.map((p) => (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} className="dp-form__grid" />
            <text x={padL - 6} y={y(p) + 3} className="dp-form__tick" textAnchor="end">
              P{p}
            </text>
          </g>
        ))}
        {avg ? (
          <g>
            <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} className="dp-form__avg" />
            <text x={W - padR + 4} y={y(avg) + 3} className="dp-form__avg-text">
              {t("driverPage.formAvgShort", { n: avg.toFixed(1) })}
            </text>
          </g>
        ) : null}
        {path ? <polyline points={path} className="dp-form__line" /> : null}
        {last.map((r, i) => {
          const dnf = r.dnf || !r.pos;
          const cy = dnf ? H - padB : y(r.pos);
          const cls = dnf ? "is-dnf" : r.pos <= 3 ? `is-p${r.pos}` : "";
          return (
            <Link key={r.id} to={raceHref(r.id)}>
              <text x={x(i)} y={cy - 9} textAnchor="middle" className={`dp-form__label ${dnf ? "is-dnf" : ""}`}>
                {dnf ? "DNF" : r.pos}
              </text>
              <circle cx={x(i)} cy={cy} r={dnf ? 5 : 5.5} className={`dp-form__dot ${cls}`}>
                <title>
                  {`${r.track}${r.sprint ? " (Sprint)" : ""} · S${r.season} D${r.division} R${r.round}: ${dnf ? "DNF" : `P${r.pos}`}`}
                </title>
              </circle>
            </Link>
          );
        })}
      </svg>
      <div className="dp-form__foot">
        <span className="dp-muted">← {t("driverPage.older")}</span>
        <span />
        <span className="dp-muted">{t("driverPage.newer")} →</span>
      </div>
    </div>
  );
}

// Favourite circuits: best average finish per circuit (finished races only).
function FavoriteCircuits({ races, t }) {
  const byTrack = new Map();
  for (const r of races) {
    const key = r.trackId ?? r.track;
    const e = byTrack.get(key) ?? { id: r.trackId, name: r.track, country: r.trackCountry, races: 0, finishes: [], wins: 0 };
    e.races++;
    if (!r.dnf && r.pos) {
      e.finishes.push(r.pos);
      if (r.pos === 1) e.wins++;
    }
    byTrack.set(key, e);
  }
  // One lucky race shouldn't decide it: use circuits with 2+ finishes when the driver has any.
  const min = [...byTrack.values()].some((e) => e.finishes.length >= 2) ? 2 : 1;
  const list = [...byTrack.values()]
    .filter((e) => e.finishes.length >= min)
    .map((e) => ({ ...e, avg: e.finishes.reduce((a, b) => a + b, 0) / e.finishes.length, best: Math.min(...e.finishes) }))
    .sort((a, b) => a.avg - b.avg || b.races - a.races)
    .slice(0, 3);
  if (!list.length) return <p className="dp-muted">{t("driverPage.noRaces")}</p>;
  return (
    <ol className="dp-fav">
      {list.map((e, i) => {
        const content = (
          <>
            <span className="dp-fav__rank">{i + 1}</span>
            {e.country ? (
              <img
                className="dp-fav__flag"
                src={`/flags/${e.country}.png`}
                alt=""
                onError={(ev) => (ev.currentTarget.style.visibility = "hidden")}
              />
            ) : (
              <span className="dp-fav__flag" />
            )}
            <span className="dp-fav__name">
              {e.name}
              <span className="dp-muted dp-fav__meta">
                {t("driverPage.favRaces", { count: e.races })}
                {" · "}
                {e.wins ? t("driverPage.favWins", { count: e.wins }) : t("driverPage.favBest", { n: e.best })}
              </span>
            </span>
            <span className="dp-fav__avg">
              P{e.finishes.length === 1 ? e.avg : e.avg.toFixed(1)}
              <small>{t("driverPage.favAvg")}</small>
            </span>
          </>
        );
        return (
          <li key={e.id ?? e.name}>
            {e.id ? (
              <Link to={`/STB/Track/${e.id}`} className="dp-fav__row">
                {content}
              </Link>
            ) : (
              <div className="dp-fav__row">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CountryDialog({ current, onClose, onSave, t }) {
  const [flags, setFlags] = useState([]);
  const [value, setValue] = useState(current || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/flags/1_manifest.json")
      .then((r) => r.json())
      .then(setFlags)
      .catch(() => setFlags([]));
  }, []);
  const save = async () => {
    setSaving(true);
    setError(false);
    const ok = await onSave(value);
    setSaving(false);
    if (ok) onClose();
    else setError(true);
  };
  return (
    <div className="dp-overlay" onClick={onClose}>
      <div className="dp-dialog stb-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="dp-section-title">{t("flagPicker.title")}</h2>
        <div className="dp-dialog__row">
          {value ? <img className="dp-hero__flag" src={`/flags/${value}.png`} alt="" /> : null}
          <select value={value} onChange={(e) => setValue(e.target.value)} aria-label={t("flagPicker.select")}>
            <option value="">{t("flagPicker.select")}</option>
            {flags.map((f) => {
              const c = f.replace(".png", "");
              return (
                <option key={c} value={c}>
                  {t(`countries.${c}`, c)}
                </option>
              );
            })}
          </select>
        </div>
        {error ? <p className="dp-error">{t("driverPage.countryFailed")}</p> : null}
        <div className="dp-dialog__actions">
          <button className="dp-btn dp-btn--ghost" onClick={onClose}>
            {t("misc.close")}
          </button>
          <button className="btn-primary dp-btn" onClick={save} disabled={!value || saving}>
            {saving ? t("misc.saving") : t("misc.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFound({ name, t }) {
  return (
    <div className="driver-page">
      <div className="stb-panel dp-notfound">
        <span className="eyebrow">{t("driverPage.eyebrow")}</span>
        <h1 className="dp-hero__name">{t("driverPage.notFoundTitle")}</h1>
        <p className="dp-muted">{t("driverPage.notFoundText", { name })}</p>
        <div className="dp-dialog__actions">
          <Link to="/" className="dp-btn dp-btn--ghost">
            {t("driverPage.backHome")}
          </Link>
          <Link to="/STB/Stats" className="btn-primary dp-btn">
            {t("driverPage.viewStats")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------- page ----------
export default function DriverPage() {
  const { driverName } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | notfound | error
  const [myClaim, setMyClaim] = useState(null); // the driver the logged-in user already claimed
  const [editCountry, setEditCountry] = useState(false);
  const [notice, setNotice] = useState(null);
  const me = useMemo(readMe, []);

  usePageMeta(
    data ? `${data.driver.name} – Driver` : driverName ? `${driverName} – Driver` : null,
    data
      ? `${data.driver.name} in the STB Racing League: ${data.career.races} races, ${data.career.wins} wins, ${data.career.podiums} podiums.`
      : null
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/driver/profile/${encodeURIComponent(driverName)}`);
      if (res.status === 404) return setStatus("notfound");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [driverName]);

  useEffect(() => {
    setStatus("loading");
    setData(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!me?.username) return;
    fetch(`${API_BASE}/api/user/${encodeURIComponent(me.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMyClaim)
      .catch(() => setMyClaim(null));
  }, [me]);

  const fmtDate = useCallback(
    (d) => (d ? new Date(String(d).replace(" ", "T")).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" }) : ""),
    [i18n.language]
  );

  const claim = async () => {
    const res = await fetch(`${API_BASE}/api/driver/claim/${encodeURIComponent(data.driver.name)}`, { method: "PUT", headers: authHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice(body.message || t("driverPage.claimFailed"));
    setMyClaim(body.driver ?? true);
    load();
  };

  const saveCountry = async (country) => {
    const res = await fetch(`${API_BASE}/api/driver/updateCountry/${data.driver.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ country }),
    }).catch(() => null);
    if (!res?.ok) return false;
    load();
    return true;
  };

  if (status === "loading") return <DriverLoader />;
  if (status === "notfound") return <NotFound name={driverName} t={t} />;
  if (status === "error" || !data)
    return (
      <div className="driver-page">
        <p className="dp-error">{t("driverPage.loadFailed")}</p>
      </div>
    );

  return (
    <div className="driver-page dp">
      <Hero data={data} me={me} myClaim={myClaim} onClaim={claim} onEditCountry={() => setEditCountry(true)} t={t} />
      {notice ? (
        <p className="dp-error" role="alert">
          {notice}
        </p>
      ) : null}

      <CareerTiles career={data.career} t={t} lang={i18n.language} />

      <div className="dp-grid-2">
        <LastRace race={data.lastRace} fmtDate={fmtDate} t={t} />
        <RecentRaces races={data.races} t={t} />
      </div>

      <SeasonsTable seasons={data.seasons} t={t} />

      <div className="dp-grid-charts">
        <article className="stb-panel dp-panel dp-panel--heat">
          <h2 className="dp-section-title">{t("driverPage.startFinish")}</h2>
          {data.races.some((r) => r.grid && r.pos && !r.dnf) ? (
            <StartFinishHeatmap races={data.races} t={t} />
          ) : (
            <p className="dp-muted">{t("driverPage.noRaces")}</p>
          )}
        </article>
        <div className="dp-stack">
          <article className="stb-panel dp-panel">
            <h2 className="dp-section-title">{t("driverPage.breakdownTitle")}</h2>
            {data.races.length ? <ResultsBreakdown races={data.races} t={t} /> : <p className="dp-muted">{t("driverPage.noRaces")}</p>}
          </article>
          <article className="stb-panel dp-panel">
            <h2 className="dp-section-title">{t("driverPage.pointsFinishes")}</h2>
            <PointsFinishes races={data.races} t={t} />
          </article>
          <article className="stb-panel dp-panel">
            <h2 className="dp-section-title">{t("driverPage.form")}</h2>
            <FormChart races={data.races} t={t} />
          </article>
          <article className="stb-panel dp-panel">
            <h2 className="dp-section-title">{t("driverPage.favorites")}</h2>
            <FavoriteCircuits races={data.races} t={t} />
          </article>
        </div>
      </div>

      {editCountry ? <CountryDialog current={data.driver.country} onClose={() => setEditCountry(false)} onSave={saveCountry} t={t} /> : null}
    </div>
  );
}
