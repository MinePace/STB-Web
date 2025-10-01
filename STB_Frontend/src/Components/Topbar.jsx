import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Topbar.css";
import { useShortcut } from "@/Components/ShortCut";
import "@/Components/Links.css"
import { use } from "react";

function Topbar() {
  const [claimedDriver, setClaimedDriver] = useState(null);
  const isLoggedIn = localStorage.getItem("token") !== null;
  const username = localStorage.getItem("name") || "";
  const role = localStorage.getItem("role") || "user";
  const navigate = useNavigate();

  // ✅ Fetch the claimed driver when component mounts
  useEffect(() => {
    if (isLoggedIn && username) {
      fetch(`http://localhost:5110/api/driver/user/${username}`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setClaimedDriver(data);
          }
        })
        .catch((err) => console.error("Error fetching claimed driver:", err));
    }
  }, [isLoggedIn, username]);

  useShortcut("d", () => {
    if (claimedDriver) {
      navigate(`/STB/Driver/${claimedDriver.name}`);
    }
  }, { alt: false, shift: false, caps: true });
  useShortcut("h", () => navigate("/"), { alt: true, shift: true });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    alert("Logged out");
    navigate("/login");
  };

  return (
    <div className="topbar">
      <div className="logo-container">
        <Link to="/">
          <img src="/STB.png" alt="Championship Logo" className="logo" />
        </Link>
      </div>
      <div className="nav-container">
        <ul className="nav-links">
          <li>
            <Link to="/" className="topbar-link">Home</Link>
          </li>
          <li>
            <a 
              href="https://www.youtube.com/@stbracingleague" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link"
            >
              <img src="/youtube.png" alt="YouTube" className="youtube-icon" />
            </a>
          </li>
          <li>
            <a 
              href="https://discord.gg/CCa6Xdwn" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link"
            >
              <img src="/discord.png" alt="Discord" className="discord-icon" />
            </a>
          </li>
          {role === "Admin" && (
            <li>
              <Link to="/admin" className="topbar-link">Admin Hub</Link>
            </li>
          )}
          {isLoggedIn && claimedDriver ? (
            <li>
              <Link to={`/STB/Driver/${claimedDriver.name}`} className="topbar-link">
                My Driver
              </Link>
            </li>
          ) : isLoggedIn ? (
            <li>
              <span className="no-driver-message">You need to claim a driver first!</span>
            </li>
          ) : (
            <li>
              <Link to="/login" className="topbar-link">Login</Link>
            </li>
          )}
          {isLoggedIn && (
            <li>
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Topbar;
