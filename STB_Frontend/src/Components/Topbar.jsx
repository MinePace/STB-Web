import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Topbar.css";
import { useShortcut } from "@/Components/ShortCut";
import { useTranslation } from "react-i18next";
import { API_BASE } from "@/config";
import { useSeasons } from "@/seasons";

function useOutsideClick(ref, handler, when = true) {
  useEffect(() => {
    if (!when) return;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && handler();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [ref, handler, when]);
}

/** Small, accessible dropdown that lives inside Topbar.jsx */
function SocialDropdown({ label = "Socials", links = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);

  const items = useMemo(() => links.filter(Boolean), [links]);
  useOutsideClick(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const count = items.length;
      const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); itemRefs.current[(idx < 0 ? 0 : (idx + 1) % count)]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); itemRefs.current[(idx < 0 ? count - 1 : (idx - 1 + count) % count)]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); itemRefs.current[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); itemRefs.current[count - 1]?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items.length]);

  return (
    <div ref={rootRef} className="socialdd">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="socialdd__btn nav-link"
      >
        <span className="socialdd__label">{label}</span>
        <span className={`socialdd__caret ${open ? "is-open" : ""}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div role="menu" aria-label="Social links" className="socialdd__menu">
          <ul className="socialdd__list">
            {items.map((item, i) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  ref={(el) => (itemRefs.current[i] = el)}
                  className="socialdd__item"
                >
                  {item.icon && <img src={item.icon} alt="" className="socialdd__icon" />}
                  <span className="socialdd__name">{item.name}</span>
                  <span className="socialdd__open">Open ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LanguageDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);
  const { i18n, t } = useTranslation();

  const languages = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  ];

  const currentLanguage =
    languages.find((lang) => i18n.language?.startsWith(lang.code)) || languages[0];

  useOutsideClick(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      const count = languages.length;
      const idx = itemRefs.current.findIndex((el) => el === document.activeElement);

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        itemRefs.current[(idx < 0 ? 0 : (idx + 1) % count)]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        itemRefs.current[(idx < 0 ? count - 1 : (idx - 1 + count) % count)]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        itemRefs.current[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        itemRefs.current[count - 1]?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, languages.length]);

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem("language", code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="langdd">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="langdd__btn nav-link"
      >
        <span className="langdd__flag">{currentLanguage.flag}</span>
        <span className={`langdd__caret ${open ? "is-open" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div role="menu" aria-label={t("language")} className="langdd__menu">
          <ul className="langdd__list">
            {languages.map((lang, i) => (
              <li key={lang.code}>
                <button
                  type="button"
                  role="menuitem"
                  ref={(el) => (itemRefs.current[i] = el)}
                  className="langdd__item"
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="langdd__flag">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Seasons the logged-in user's claimed driver raced in: Map<season, Set<division>> */
function useRacedSeasons(username) {
  const [raced, setRaced] = useState(new Map());
  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE}/api/driver/claimeddriver/races/${username}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        const map = new Map();
        for (const { season, division } of rows || []) {
          if (!map.has(season)) map.set(season, new Set());
          if (division !== null && division !== undefined) map.get(season).add(String(division));
        }
        setRaced(map);
      })
      .catch(() => {});
  }, [username]);
  return raced;
}

/** Season -> division picker (replaces the old sidebar). Used in the dropdown and the mobile menu. */
function SeasonGrid({ raced, onPick, collapsePast = false }) {
  const { t } = useTranslation();
  const { seasons } = useSeasons();
  const [current, ...past] = seasons;
  const row = (season) => (
    <div key={season.year} className={`season-row ${raced.has(season.year) ? "is-raced" : ""}`}>
      <span className="season-row__label">
        {t("sidebar.season")} {season.year}
      </span>
      <span className="season-row__divs">
        {season.divisions.map((d) => (
          <Link
            key={d}
            to={`/STB/Championship/${season.year}/${d}`}
            onClick={onPick}
            className={`div-chip ${raced.get(season.year)?.has(d) ? "is-raced" : ""}`}
            title={raced.get(season.year)?.has(d) ? t("nav.youRaced") : undefined}
          >
            {t("sidebar.division")} {d}
          </Link>
        ))}
      </span>
    </div>
  );
  return (
    <div className="season-grid">
      <p className="season-grid__title">{t("nav.currentSeason")}</p>
      {row(current)}
      {collapsePast ? (
        <details className="season-grid__fold">
          <summary className="season-grid__title">{t("nav.pastSeasons")}</summary>
          <div className="season-grid__past">{past.map(row)}</div>
        </details>
      ) : (
        <>
          <p className="season-grid__title">{t("nav.pastSeasons")}</p>
          <div className="season-grid__past">{past.map(row)}</div>
        </>
      )}
    </div>
  );
}

function ChampionshipMenu({ raced }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useOutsideClick(rootRef, () => setOpen(false), open);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="champ-menu">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`nav-link ${pathname.startsWith("/STB/Championship") ? "is-active" : ""}`}
      >
        {t("nav.championship")} <span className={`caret ${open ? "is-open" : ""}`} aria-hidden>▾</span>
      </button>
      {open && (
        <div className="champ-menu__panel">
          <SeasonGrid raced={raced} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

const SOCIAL_LINKS = [
  { id: "youtube", name: "YouTube", href: "https://www.youtube.com/@stbracingleague", icon: "/youtube.png" },
  { id: "discord", name: "Discord", href: "https://discord.gg/jQXYKBbEws", icon: "/discord.webp" },
  { id: "tiktok", name: "TikTok", href: "https://www.tiktok.com/@stbracingleague", icon: "/tiktok.png" },
  { id: "twitch", name: "Twitch", href: "https://www.twitch.tv/stbleague", icon: "/twitch.png" },
];

function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [claimedDriver, setClaimedDriver] = useState(null);
  const isLoggedIn = localStorage.getItem("token") !== null;
  const [username, setUsername] = useState("");
  const [roleState, setRoleState] = useState("user");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const raced = useRacedSeasons(username);
  const { current: currentSeason } = useSeasons();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      setRoleState(decoded.role);
      setUsername(decoded.username);
    } catch (e) {
      console.log("JWT decode failed:", e);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      fetch(`${API_BASE}/api/driver/user/${username}`)
        .then((res) => res.json())
        .then((data) => data && setClaimedDriver(data))
        .catch((err) => console.error("Error fetching claimed driver:", err));
    }
  }, [isLoggedIn, username]);

  // Close the mobile menu on navigation; lock page scroll while it is open.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    alert("Logged out");
    navigate("/login");
  };

  const navCls = ({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`;
  const close = () => setMenuOpen(false);

  const account = (
    <>
      {roleState === "Admin" && (
        <NavLink to="/admin" className={navCls} onClick={close}>
          {t("nav.adminHub")}
        </NavLink>
      )}
      {isLoggedIn && claimedDriver ? (
        <NavLink to={`/STB/Driver/${claimedDriver.name}`} className={navCls} onClick={close}>
          {t("nav.myDriver")}
        </NavLink>
      ) : isLoggedIn ? (
        <span className="no-driver-message">{t("nav.claimDriverFirst")}</span>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `nav-link nav-link--cta ${isActive ? "is-active" : ""}`} onClick={close}>
          {t("nav.login")}
        </NavLink>
      )}
      {isLoggedIn && (
        <button onClick={handleLogout} className="nav-link nav-link--quiet">
          {t("nav.logout")}
        </button>
      )}
    </>
  );

  return (
    <>
    <header className="site-header">
      <div className="site-header__stripe" />
      <div className="site-header__inner">
        <Link to="/" className="brand" aria-label="STB Racing League home">
          <img src="/STB3.png" alt="STB Racing League" className="brand__logo" />
          <span className="brand__text">
            <span className="brand__name">STB League</span>
            <span className="brand__season">
              {t("sidebar.season")} {currentSeason}
            </span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main">
          <NavLink to="/" end className={navCls}>
            {t("nav.home")}
          </NavLink>
          <ChampionshipMenu raced={raced} />
          <NavLink to="/STB/History" className={navCls}>
            {t("nav.history")}
          </NavLink>
          <NavLink to="/STB/Stats" className={navCls}>
            {t("nav.stats")}
          </NavLink>
          <SocialDropdown label={t("nav.socials")} links={SOCIAL_LINKS} />
        </nav>

        <div className="header-actions">
          <LanguageDropdown />
          {account}
        </div>

        <button
          className="menu-toggle"
          aria-label={t("nav.menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>

      {/* Mobile drawer: outside the header, because the header's backdrop-filter would clip it */}
      <div className={`drawer-backdrop ${menuOpen ? "is-open" : ""}`} onClick={close} />
      <aside className={`drawer ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <nav className="drawer__nav" aria-label="Mobile">
          <NavLink to="/" end className={navCls} onClick={close}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/STB/History" className={navCls} onClick={close}>
            {t("nav.history")}
          </NavLink>
          <NavLink to="/STB/Stats" className={navCls} onClick={close}>
            {t("nav.stats")}
          </NavLink>
        </nav>
        <p className="drawer__heading">{t("nav.championship")}</p>
        <SeasonGrid raced={raced} onPick={close} collapsePast />
        <p className="drawer__heading">{t("nav.socials")}</p>
        <div className="drawer__socials">
          {SOCIAL_LINKS.map((s) => (
            <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" className="drawer__social">
              <img src={s.icon} alt="" /> {s.name}
            </a>
          ))}
        </div>
        <div className="drawer__account">
          <LanguageDropdown />
          {account}
        </div>
      </aside>
    </>
  );
}

export default Topbar;
