import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./TrackPage.css";
import "@/Components/Links.css";
import DriverLoader from "@/Components/Loaders/DriverLoader";
import { API_BASE } from "@/config";

import usePageMeta from "@/usePageMeta";
import { getMapCandidates } from "@/trackMap";


/* ---------- component ---------- */

function TrackPage() {
  const { trackId } = useParams();
  const { t, i18n } = useTranslation();

  const [trackInfo, setTrackInfo] = useState(null);
  const trackName = trackInfo?.raceName || trackInfo?.RaceName || trackInfo?.name || trackInfo?.Name;
  usePageMeta(
    trackName ? `${trackName} – Circuit` : null,
    trackName ? `Every STB Racing League race at ${trackName}: winners, results and records.` : null
  );
  const [trackRaces, setTrackRaces] = useState([]);

  const mostWins = useMemo(
    () => topWinnerFirstAchievedBySeason(trackRaces, { includeSprint: true }),
    [trackRaces]
  );

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [errorRaces, setErrorRaces] = useState(null);

  const [mapOk, setMapOk] = useState(true);
  const [mapIdx, setMapIdx] = useState(0);

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/track/${encodeURIComponent(trackId || "")}`
        );
        if (!res.ok) throw new Error("Failed to fetch track info");
        const data = await res.json();
        if (!abort) setTrackInfo(data);
      } catch (err) {
        if (!abort) setErrorInfo(err.message);
      } finally {
        if (!abort) setLoadingInfo(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/track/races/${encodeURIComponent(trackId || "")}`
        );
        if (!res.ok) throw new Error("Failed to fetch track races");
        const races = await res.json();
        if (!abort) setTrackRaces(Array.isArray(races) ? races : []);
      } catch (err) {
        if (!abort) setErrorRaces(err.message);
      } finally {
        if (!abort) setLoadingRaces(false);
      }
    })();

    setMapOk(true);
    setMapIdx(0);

    return () => {
      abort = true;
    };
  }, [trackId]);

  const loading = loadingInfo || loadingRaces;

  if (loading) return <DriverLoader />;
  if (!trackInfo)
    return (
      <div className="tk-page">
        <div className="stb-panel tk-notfound">
          <span className="eyebrow">{t("trackPage.eyebrow")}</span>
          <h1 className="tk-title">{t("trackPage.notFound")}</h1>
          <p className="tk-muted">{errorInfo || ""}</p>
          <Link to="/" className="tk-btn">
            {t("trackPage.backHome")}
          </Link>
        </div>
      </div>
    );

  const { Name, RaceName, Country, Length, Turns } = trackInfo;

  const mapCandidates = getMapCandidates({ Country, Name, LayoutUrl: trackInfo?.LayoutUrl });
  const mapSrc = mapOk && mapCandidates.length ? mapCandidates[mapIdx] : null;

  const sorted = trackRaces.slice().sort(compareBySeasonRound);
  const winnerOf = (r) => (r.RaceResults || []).find((x) => x?.Position === 1 && !isDNF(x))?.Drivers?.Name;
  const winners = new Set(sorted.map(winnerOf).filter(Boolean));
  const firstSeason = sorted.length ? Math.min(...sorted.map((r) => Number(r.Season)).filter((n) => !isNaN(n))) : null;

  const tiles = [
    ["length", formatLength(Length)],
    ["turns", Turns ?? "—"],
    ["races", trackRaces.length],
    ["winners", winners.size || "—"],
    ["mostWins", mostWins?.Count ?? "—", mostWins?.Name],
  ];

  return (
    <div className="tk-page">
      {/* HERO */}
      <header className="tk-hero stb-panel racing-stripes">
        <div className="tk-hero__main">
          <span className="eyebrow">
            {t("trackPage.eyebrow")}
            {Country ? ` · ${t(`countries.${Country}`, Country)}` : ""}
          </span>
          <div className="tk-hero__name">
            {Country ? <img src={`/flags/${Country}.png`} alt={Country} className="tk-flag" /> : null}
            <h1 className="tk-title">{Name}</h1>
          </div>
          {RaceName ? <p className="tk-sub">{RaceName}</p> : null}
          <div className="tk-chips">
            {Length != null ? <span className="tk-chip">{formatLength(Length)}</span> : null}
            {Turns != null ? <span className="tk-chip">{t("trackPage.turnsCount", { count: Turns })}</span> : null}
            {firstSeason ? <span className="tk-chip">{t("trackPage.since", { n: firstSeason })}</span> : null}
          </div>
        </div>
        <div className="tk-map">
          {mapSrc && mapOk ? (
            <img
              src={mapSrc}
              alt={`${Name} layout`}
              loading="lazy"
              onError={() => {
                setMapIdx((i) => {
                  const next = i + 1;
                  if (next < mapCandidates.length) return next;
                  setMapOk(false);
                  return i;
                });
              }}
            />
          ) : (
            <div className="tk-map__empty tk-muted">{t("trackPage.noMap")}</div>
          )}
        </div>
      </header>

      {/* STATS */}
      <section>
        <h2 className="tk-section-title">{t("trackPage.stats")}</h2>
        <div className="tk-tiles">
          {tiles.map(([key, value, sub]) => (
            <div key={key} className="stb-panel tk-tile">
              <span className="tk-tile__value">{value}</span>
              {sub ? (
                <Link to={`/STB/Driver/${encodeURIComponent(sub)}`} className="tk-tile__sub">
                  {sub}
                </Link>
              ) : null}
              <span className="tk-tile__label">{t(`trackPage.tiles.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* RACES */}
      <section>
        <h2 className="tk-section-title">{t("trackPage.racesHere")}</h2>
        {errorRaces ? <p className="tk-muted">{errorRaces}</p> : null}
        {sorted.length === 0 ? (
          <p className="tk-muted">{t("trackPage.noRaces")}</p>
        ) : (
          <div className="tk-races">
            {sorted.map((r) => {
              const results = (r.RaceResults ?? []).slice().sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
              return (
                <article className="stb-panel tk-race" key={r.Id}>
                  <header className="tk-race__head">
                    <div>
                      <Link to={`/STB/Championship/${r.Season}/${r.Division}`} className="tk-race__where">
                        {t("trackPage.where", { s: r.Season, d: r.Division, r: r.Round })}
                      </Link>
                      <span className="tk-muted">
                        {r.Date ? formatDate(r.Date, i18n.language) : ""}
                        {r.Sprint === "Yes" ? <span className="tk-tag">{t("trackPage.sprint")}</span> : null}
                      </span>
                    </div>
                  </header>
                  {results.length ? (
                    <ol className="tk-podium">
                      {results.slice(0, 3).map((res, i) => (
                        <li key={i}>
                          <span className={`pos-badge ${isDNF(res) ? "pos-badge--dnf" : res.Position <= 3 ? `pos-badge--p${res.Position}` : ""}`}>
                            {isDNF(res) ? "DNF" : posLabel(res)}
                          </span>
                          <Link to={`/STB/Driver/${encodeURIComponent(res.Drivers?.Name ?? "")}`} className="tk-podium__name">
                            {res.Drivers?.Name ?? "?"}
                          </Link>
                          <span className="tk-podium__pts">
                            {isDNF(res) ? "" : `${res.Points ?? 0} ${t("trackPage.pts")}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="tk-muted">{t("trackPage.noResult")}</p>
                  )}
                  <Link to={`/STB/Race/${r.Id}`} className="tk-race__more">
                    {t("trackPage.fullResult")} →
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatLength(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(3)} km`;
}

function formatDate(d, lang) {
  try {
    return new Date(String(d).replace(" ", "T")).toLocaleDateString(lang, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return d ?? "—";
  }
}

function isDNF(res) {
  return res?.DNF === "Yes" || res?.DNF === "DNF";
}

function posLabel(res) {
  if (typeof res?.Position === "number") return `P${res.Position}`;
  return isDNF(res) ? "DNF" : "—";
}

function toPosSortKey(res) {
  return typeof res?.Position === "number"
    ? res.Position
    : Number.POSITIVE_INFINITY;
}

function compareBySeasonRound(a, b) {
  const sa = Number(a.Season ?? -Infinity);
  const sb = Number(b.Season ?? -Infinity);
  if (sb !== sa) return sb - sa;
  const ra = Number(a.Round ?? -Infinity);
  const rb = Number(b.Round ?? -Infinity);
  return rb - ra;
}

function topWinnerFirstAchievedBySeason(races, { includeSprint = true } = {}) {
  if (!Array.isArray(races) || races.length === 0) return null;

  const asc = [...races].sort((a, b) => {
    const sa = Number(a?.Season);
    const sb = Number(b?.Season);
    if (sa !== sb) return (isNaN(sa) ? Infinity : sa) - (isNaN(sb) ? Infinity : sb);

    const ra = Number(a?.Round);
    const rb = Number(b?.Round);
    return (isNaN(ra) ? Infinity : ra) - (isNaN(rb) ? Infinity : rb);
  });

  const counts = new Map();
  let leaderName = null;
  let leaderCount = 0;

  for (const r of asc) {
    if (!includeSprint && r?.Sprint === "Yes") continue;

    const winner = (r?.RaceResults || []).find(rr => rr?.Position === 1);
    if (!winner?.Drivers?.Name) continue;

    const driverName = winner.Drivers.Name;

    const next = (counts.get(driverName) || 0) + 1;
    counts.set(driverName, next);

    if (next > leaderCount) {
      leaderCount = next;
      leaderName = driverName;
    }
  }

  if (!leaderName) return null;
  return { Count: leaderCount, Name: leaderName };
}

export default TrackPage;
