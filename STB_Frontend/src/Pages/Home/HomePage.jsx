import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./HomePage.css";
import { API_BASE } from "@/config";
import { useSeasons } from "@/seasons";
import { teamColor, teamLogo } from "@/teams";

const DISCORD_URL = "https://discord.gg/jQXYKBbEws";
const YOUTUBE_URL = "https://www.youtube.com/@stbracingleague";
const TWITCH_URL = "https://www.twitch.tv/stbleague";

const nameOf = (x) => (typeof x === "object" && x !== null ? x.Name ?? "Unknown" : x ?? "Unknown");

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ---------- Small building blocks ----------

function TeamTag({ team }) {
  return (
    <span className="hp-team">
      <span className="hp-team__bar" style={{ backgroundColor: teamColor(team) }} />
      <img src={teamLogo(team)} alt="" className="hp-team__logo" onError={(e) => (e.currentTarget.style.display = "none")} />
      <span className="hp-team__name">{team}</span>
    </span>
  );
}

function DriverLink({ name, className = "" }) {
  return (
    <Link to={`/STB/Driver/${encodeURIComponent(name)}`} className={`hp-driver ${className}`}>
      {name}
    </Link>
  );
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="hp-skeleton" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="hp-stat stb-panel">
      <div className="hp-stat__top">
        <span className="hp-stat__label">{label}</span>
        <span className="hp-stat__icon" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="hp-stat__value">{value ?? "—"}</div>
      {sub && <div className="hp-stat__sub">{sub}</div>}
    </div>
  );
}

// Podium: P2 left, P1 middle (tallest), P3 right
function Podium({ entries }) {
  const order = [1, 0, 2].filter((i) => entries[i]);
  return (
    <div className="hp-podium">
      {order.map((i) => {
        const e = entries[i];
        return (
          <div key={i} className={`hp-podium__step hp-podium__step--p${i + 1}`}>
            <span className={`pos-badge pos-badge--p${i + 1}`}>P{i + 1}</span>
            <DriverLink name={e.name} className="hp-podium__name" />
            <TeamTag team={e.team} />
            <div className="hp-podium__meta">
              {e.time && <span className="hp-podium__time">{e.time}</span>}
              <span className="hp-podium__pts">
                {e.points} <small>pts</small>
              </span>
            </div>
            <div className="hp-podium__block" />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Page ----------

function HomePage() {
  const { t, i18n } = useTranslation();
  const { current: CURRENT_SEASON, latestWithResults } = useSeasons();

  const [latest, setLatest] = useState(null);
  const [latestState, setLatestState] = useState("loading");
  const [stats, setStats] = useState(null);
  const [standings, setStandings] = useState([]);
  const [seasonRaces, setSeasonRaces] = useState([]);
  const [divIdx, setDivIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    getJson("/api/race/latest")
      .then((data) => {
        setLatest({
          id: data.Race.Id,
          season: data.Race.Season,
          division: data.Race.Division,
          round: data.Race.Round,
          sprint: data.Race.Sprint === "Yes",
          track: data.Race.Track?.Name,
          country: data.Race.Track?.Country,
          youtube: data.Race.YoutubeLink,
          podium: data.Results.slice(0, 3).map((r, i) => ({
            name: nameOf(r.Driver),
            team: nameOf(r.Team),
            points: Number(r.Points) || 0,
            time: r.DNF === "Yes" ? "DNF" : r.Time ? (i === 0 ? r.Time : `+${r.Time}`) : null,
          })),
        });
        setLatestState("ok");
      })
      .catch(() => setLatestState("error"));

    getJson("/api/stats/league").then(setStats).catch(() => setStats({}));

    getJson("/api/championship/current")
      .then((data) =>
        setStandings(
          (data || [])
            .map((d) => ({
              division: d.Division,
              top3: (d.Top3 || []).map((x) => ({ name: nameOf(x.Name), team: nameOf(x.Team), points: x.TotalPoints })),
            }))
            .sort((a, b) => a.division - b.division)
        )
      )
      .catch(() => setStandings([]));

  }, []);

  useEffect(() => {
    if (!CURRENT_SEASON) return;
    getJson(`/api/race/season/${CURRENT_SEASON}`)
      .then((data) => setSeasonRaces(Array.isArray(data) ? data : []))
      .catch(() => setSeasonRaces([]));
  }, [CURRENT_SEASON]);

  // Rotate through the divisions every 5 seconds (pauses on hover).
  useEffect(() => {
    if (standings.length < 2 || paused) return;
    const id = setInterval(() => setDivIdx((i) => (i + 1) % standings.length), 5000);
    return () => clearInterval(id);
  }, [standings.length, paused]);

  // Season progress from the race calendar.
  const season = useMemo(() => {
    const main = seasonRaces.filter((r) => r.Sprint !== "Yes");
    const divisions = new Set(main.map((r) => r.Division)).size || standings.length;
    const rounds = Math.max(0, ...main.map((r) => r.Round));
    const now = new Date();
    const upcoming = main
      .filter((r) => r.Date && new Date(r.Date.replace(" ", "T")) >= now)
      .sort((a, b) => a.Date.localeCompare(b.Date));
    return { divisions, rounds, next: upcoming[0] || null, remaining: upcoming.length };
  }, [seasonRaces, standings.length]);

  const fmtDate = (s) =>
    new Date(s.replace(" ", "T")).toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "long" });

  const current = standings[divIdx % Math.max(standings.length, 1)];

  return (
    <div className="hp">
      {/* ---------- Hero ---------- */}
      <section className="hp-hero stb-panel racing-stripes">
        <div className="hp-hero__glow" />
        <img src="/STB3.png" alt="" aria-hidden className="hp-hero__logo" />
        <p className="eyebrow">
          {t("sidebar.season")} {CURRENT_SEASON}
          {season.divisions ? ` · ${season.divisions} ${t("home.divisions")}` : ""}
        </p>
        <h1 className="hp-hero__title">
          {t("home.heroTitle")} <span className="hp-accent">STB League</span>
        </h1>
        <p className="hp-hero__sub">
          {season.next
            ? t("home.nextRace", {
                track: season.next.Tracks?.RaceName || season.next.Tracks?.Name,
                date: fmtDate(season.next.Date),
              })
            : season.rounds
            ? t("home.seasonDone", { rounds: season.rounds })
            : t("home.welcome")}
        </p>
        <div className="hp-hero__actions">
          <Link to={`/STB/Championship/${latestWithResults}/1`} className="hp-btn hp-btn--primary">
            🏆 {t("home.standings")}
          </Link>
          <Link to="/STB/History" className="hp-btn">
            {t("nav.history")}
          </Link>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn--ghost">
            <img src="/discord.webp" alt="" /> Discord
          </a>
        </div>
      </section>

      <div className="hp-grid">
        {/* ---------- Latest race ---------- */}
        <section className="hp-card stb-panel hp-card--wide">
          <header className="hp-card__head">
            <div>
              <p className="eyebrow">{t("home.latest")}</p>
              <h2 className="hp-card__title">
                {latest?.country && (
                  <img src={`/flags/${latest.country}.png`} alt="" className="hp-flag" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                {latest?.track ?? "—"}
              </h2>
              {latest && (
                <p className="hp-card__sub">
                  {t("sidebar.season")} {latest.season} · {t("sidebar.division")} {latest.division} · {t("home.round")}{" "}
                  {latest.round}
                  {latest.sprint ? " · Sprint" : ""}
                </p>
              )}
            </div>
            {latest && (
              <div className="hp-card__actions">
                {latest.youtube && (
                  <a href={latest.youtube} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn--small">
                    ▶ {t("home.watch")}
                  </a>
                )}
                <Link to={`/STB/Race/${latest.id}`} className="hp-btn hp-btn--small">
                  {t("home.viewDetails")} →
                </Link>
              </div>
            )}
          </header>
          {latestState === "loading" && <Skeleton lines={3} />}
          {latestState === "error" && <p className="hp-empty">{t("home.noData")}</p>}
          {latest && <Podium entries={latest.podium} />}
        </section>

        {/* ---------- Championship (rotating divisions) ---------- */}
        <section
          className="hp-card stb-panel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <header className="hp-card__head">
            <div>
              <p className="eyebrow">{t("nav.championship")}</p>
              <h2 className="hp-card__title">
                {t("sidebar.division")} {current?.division ?? "—"}
              </h2>
            </div>
            <div className="hp-dots" role="tablist" aria-label={t("sidebar.division")}>
              {standings.map((s, i) => (
                <button
                  key={s.division}
                  role="tab"
                  aria-selected={i === divIdx}
                  aria-label={`${t("sidebar.division")} ${s.division}`}
                  className={`hp-dot ${i === divIdx ? "is-active" : ""}`}
                  onClick={() => setDivIdx(i)}
                />
              ))}
            </div>
          </header>

          {!current ? (
            <Skeleton lines={3} />
          ) : (
            <ol key={current.division} className="hp-standings">
              {current.top3.map((d, i) => (
                <li key={d.name} className="hp-standings__row">
                  <span className={`hp-standings__pos hp-standings__pos--p${i + 1}`}>{i + 1}</span>
                  <span className="hp-standings__who">
                    <DriverLink name={d.name} />
                    <TeamTag team={d.team} />
                  </span>
                  <span className="hp-standings__pts">{d.points}</span>
                </li>
              ))}
            </ol>
          )}

          {current && (
            <Link to={`/STB/Championship/${latestWithResults}/${current.division}`} className="hp-link">
              {t("home.fullStandings")} →
            </Link>
          )}
        </section>
      </div>

      {/* ---------- League in numbers ---------- */}
      <section className="hp-section">
        <h2 className="hp-section__title">{t("home.stats.title")}</h2>
        <div className="hp-stats">
          <StatCard label={t("home.stats.seasons")} value={stats?.TotalSeasons} icon="🏆" />
          <StatCard label={t("home.divisions")} value={season.divisions || null} icon="🗂️" sub={`${t("sidebar.season")} ${CURRENT_SEASON}`} />
          <StatCard label={t("home.stats.races")} value={stats?.TotalRaces?.toLocaleString(i18n.language)} icon="🏁" />
          <StatCard label={t("home.stats.drivers")} value={stats?.TotalDrivers?.toLocaleString(i18n.language)} icon="👥" />
          <StatCard
            label={t("home.stats.mostWins")}
            value={stats?.MostWins?.Wins}
            icon="🥇"
            sub={stats?.MostWins && <DriverLink name={nameOf(stats.MostWins.Driver)} />}
          />
          <StatCard
            label={t("home.stats.mostRaces")}
            value={stats?.MostRaces?.Races}
            icon="🏎️"
            sub={stats?.MostRaces && <DriverLink name={nameOf(stats.MostRaces.Driver)} />}
          />
        </div>
      </section>

      {/* ---------- Community ---------- */}
      <section className="hp-community stb-panel racing-stripes">
        <div>
          <p className="eyebrow">{t("home.community.eyebrow")}</p>
          <h2 className="hp-community__title">{t("home.community.title")}</h2>
          <p className="hp-community__text">{t("home.community.text")}</p>
        </div>
        <div className="hp-community__actions">
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn--primary">
            <img src="/discord.webp" alt="" /> {t("home.community.join")}
          </a>
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="hp-btn">
            <img src="/youtube.png" alt="" /> YouTube
          </a>
          <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className="hp-btn">
            <img src="/twitch.png" alt="" /> Twitch
          </a>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
