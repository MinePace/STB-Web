import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Topbar.css";
import { useShortcut } from "@/Components/ShortCut";
import { useTranslation } from "react-i18next";

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
        className="socialdd__btn topbar-link"
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
        className="langdd__btn topbar-link"
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

function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false); // ← added
  const [claimedDriver, setClaimedDriver] = useState(null);
  const isLoggedIn = localStorage.getItem("token") !== null;
  const [username, setUsername] = useState("");
  const [roleState, setRoleState] = useState("user");
  const navigate = useNavigate();
  const { t } = useTranslation();

  const SOCIAL_LINKS = [
    { id: "youtube", name: "YouTube", href: "https://www.youtube.com/@stbracingleague", icon: "/youtube.png" },
    { id: "discord", name: "Discord", href: "https://discord.gg/jQXYKBbEws", icon: "/discord.webp" },
    { id: "tiktok", name: "TikTok", href: "https://www.tiktok.com/@stbracingleague", icon: "/tiktok.png" },
    { id: "twitch", name: "Twitch", href: "https://www.twitch.tv/stbleague", icon: "/twitch.png" }
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    let role = "user";
  
    if (token) {
      try {
        const decoded = jwtDecode(token);
  
        role = decoded.role;
        setRoleState(role);

        const username = decoded.username
        setUsername(username);
      } catch (e) {
        console.log("JWT decode failed:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      fetch(`https://stbleaguedata.vercel.app/api/driver/user/${username}`)
        .then((res) => res.json())
        .then((data) => data && setClaimedDriver(data))
        .catch((err) => console.error("Error fetching claimed driver:", err));
    }
  }, [isLoggedIn, username]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    alert("Logged out");
    navigate("/login");
  };

  return (
    <div className="topbar">
      <div className="logo-container">
        <Link to="/">
          <img src="/STB3.png" alt="Championship Logo" className="logo" />
        </Link>
      </div>

      {/* Hamburger menu button (only visible on small screens) */}
      <button
        className="menu-toggle"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        ☰
      </button>

      <div className={`nav-container ${menuOpen ? "open" : ""}`}>
        <ul className="nav-links">
          <li>
            <Link to="/" className="topbar-link" onClick={() => setMenuOpen(false)}>
              {t("nav.home")}
            </Link>
          </li>

          <li>
            <SocialDropdown label={t("nav.socials")} links={SOCIAL_LINKS} />
          </li>

          {roleState === "Admin" && (
            <li>
              <Link to="/admin" className="topbar-link" onClick={() => setMenuOpen(false)}>
                {t("nav.adminHub")}
              </Link>
            </li>
          )}

          {isLoggedIn && claimedDriver ? (
            <li>
              <Link
                to={`/STB/Driver/${claimedDriver.name}`}
                className="topbar-link"
                onClick={() => setMenuOpen(false)}
              >
                {t("nav.myDriver")}
              </Link>
            </li>
          ) : isLoggedIn ? (
            <li>
              <span className="no-driver-message">{t("nav.claimDriverFirst")}</span>
            </li>
          ) : (
            <li>
              <Link to="/login" className="topbar-link" onClick={() => setMenuOpen(false)}>
                {t("nav.login")}
              </Link>
            </li>
          )}

          <li>
            <LanguageDropdown />
          </li>

          {isLoggedIn && (
            <li>
              <button onClick={handleLogout} className="logout-button">
                {t("nav.logout")}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Topbar;
  