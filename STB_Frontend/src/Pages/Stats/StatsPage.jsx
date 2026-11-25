import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./StatsPage.css";
import "@/Components/Links.css";

import usePageMeta from "@/usePageMeta";
import { API_BASE } from "@/config";
import { useSeasons } from "@/seasons";

const TABS = ["wins", "podiums", "poles", "fastestLaps", "points", "races", "championships", "winRate", "avgFinish"];
const RATE_TABS = ["winRate", "avgFinish"];
const AWARD_ICONS = { comebackKing: "🏎️", consistent: "🎯", badLuck: "💥", ironMan: "🔁" };

const driverHref = (name) => `/STB/Driver/${encodeURIComponent(name)}`;

function Holder({ name, fallback }) {
  if (!name) return <span className="sp-holder sp-holder--empty">{fallback}</span>;
  return (
    <Link to={driverHref(name)} className="sp-holder">
      {name}
    </Link>
  );
}

function Leaderboard({ rows, t }) {
  if (!rows?.length) return <p className="sp-empty">{t("statsPage.noHolder")}</p>;
  return (
    <ol className="sp-board">
      {rows.map((r, i) => (
        <li key={r.name} className="sp-board__row">
          <span className={`pos-badge ${i < 3 ? `pos-badge--p${i + 1}` : "sp-board__pos"}`}>{i + 1}</span>
          <Link to={driverHref(r.name)} className="sp-board__name">
            {r.name}
          </Link>
          <span className="sp-board__sub">{r.sub ?? ""}</span>
          <span className="sp-board__value">{r.display ?? r.value}</span>
        </li>
      ))}
    </ol>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  usePageMeta("Stats", "League-wide statistics of the STB Racing League: leaderboards, records and awards.");

  const { seasons } = useSeasons();
  const [params, setParams] = useSearchParams();
  const season = params.get("season") || "";
  const division = params.get("division") || "";
  const sprints = params.get("sprints") !== "0";
  const [tab, setTab] = useState("wins");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Divisions to offer: those of the chosen season, or every division that ever existed.
  const divisions = useMemo(() => {
    if (season) return seasons.find((s) => String(s.year) === season)?.divisions ?? [];
    const all = new Set(seasons.flatMap((s) => s.divisions));
    return [...all].sort((a, b) => Number(a) - Number(b));
  }, [seasons, season]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === "" || v === null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams();
    if (season) q.set("season", season);
    if (division) q.set("division", division);
    if (!sprints) q.set("sprints", "0");
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/api/stats/overview${q.toString() ? `?${q}` : ""}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => alive && setData(json))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [season, division, sprints]);

  const scope = data?.scope;

  return (
    <div className="stats-page">
      <header className="sp-hero">
        <span className="eyebrow">{t("statsPage.eyebrow")}</span>
        <h1 className="sp-title">{t("statsPage.title")}</h1>
        {scope ? (
          <p className="sp-scope">
            {season ? t("statsPage.season", { n: season }) : t("statsPage.allTime")}
            {division ? ` · ${t("statsPage.division", { n: division })}` : ""} ·{" "}
            {t("statsPage.scope", { races: scope.races, drivers: scope.drivers })}
          </p>
        ) : null}
      </header>

      <div className="sp-filters stb-panel">
        <select value={season} onChange={(e) => update({ season: e.target.value, division: "" })} aria-label="Season">
          <option value="">{t("statsPage.allTime")}</option>
          {seasons.map((s) => (
            <option key={s.year} value={s.year}>
              {t("statsPage.season", { n: s.year })}
            </option>
          ))}
        </select>
        <select value={division} onChange={(e) => update({ division: e.target.value })} aria-label="Division">
          <option value="">{t("statsPage.allDivisions")}</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {t("statsPage.division", { n: d })}
            </option>
          ))}
        </select>
        <label className="sp-toggle">
          <input type="checkbox" checked={sprints} onChange={(e) => update({ sprints: e.target.checked ? "" : "0" })} />
          <span>{t("statsPage.sprints")}</span>
        </label>
      </div>

      {error ? <p className="sp-empty">{t("statsPage.error")}</p> : null}
      {loading && !data ? <p className="sp-empty">{t("statsPage.loading")}</p> : null}

      {data ? (
        <div className={`sp-content ${loading ? "is-loading" : ""}`}>
          <section>
            <h2 className="sp-section-title">{t("statsPage.awards")}</h2>
            <div className="sp-awards">
              {data.awards.map((a) => (
                <article key={a.key} className="stb-panel sp-award">
                  <span className="sp-award__icon" aria-hidden>
                    {AWARD_ICONS[a.key] ?? "🏆"}
                  </span>
                  <span className="sp-card__label">{t(`statsPage.awards_.${a.key}`, a.title)}</span>
                  <Holder name={a.holder} fallback={t("statsPage.noHolder")} />
                  <span className="sp-card__value">{a.holder ? a.value : ""}</span>
                  <span className="sp-card__detail">{t(`statsPage.awardInfo.${a.key}`, a.detail)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="stb-panel sp-boards">
            <div className="sp-boards__head">
              <h2 className="sp-section-title">{t("statsPage.leaderboards")}</h2>
              {RATE_TABS.includes(tab) ? <span className="sp-card__detail">{t("statsPage.minRaces", { n: scope?.minRaces })}</span> : null}
            </div>
            <div className="sp-tabs" role="tablist">
              {TABS.map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={`sp-tab ${tab === k ? "is-active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {t(`statsPage.tabs.${k}`)}
                </button>
              ))}
            </div>
            <Leaderboard rows={data.leaderboards[tab]} t={t} />
          </section>

          <section>
            <h2 className="sp-section-title">{t("statsPage.records")}</h2>
            <div className="sp-records">
              {data.records.map((r) => (
                <article key={r.key} className="stb-panel sp-record">
                  <span className="sp-card__label">{t(`statsPage.records_.${r.key}`, r.title)}</span>
                  <span className="sp-card__value">{r.holder ? r.value : "–"}</span>
                  <Holder name={r.holder} fallback={t("statsPage.noHolder")} />
                  {r.detail ? (
                    r.raceId ? (
                      <Link to={`/STB/Race/${r.raceId}`} className="sp-card__detail sp-card__detail--link">
                        {r.detail}
                      </Link>
                    ) : (
                      <span className="sp-card__detail">{r.detail}</span>
                    )
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
