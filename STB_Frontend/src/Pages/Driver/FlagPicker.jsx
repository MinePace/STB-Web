import React, { useState, useEffect } from "react";
import "./FlagPicker.css";

export default function FlagPicker({ driver, onClose }) {
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    // Simulated user fetch (replace with your real one)
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("name");
    if (!token || !name) return;

    fetch(`https://stbleague.fly.dev/api/user/${name}`)
      .then((res) => res.json())
      .then((data) => setUser(data))
      .catch((err) => console.error("Failed to load user", err));

    // Load list of available flags (static for now)
    setCountries([
      { name: "France", flag: "/flags/France.png" },
      { name: "Germany", flag: "/flags/Germany.png" },
      { name: "United Kingdom", flag: "/flags/United Kingdom.png" },
      { name: "United States", flag: "/flags/United States.png" },
      { name: "Spain", flag: "/flags/Spain.png" },
      { name: "Italy", flag: "/flags/Italy.png" },
    ]);
  }, []);

  const handleClickNat = () => {
    if (user?.isAdmin && !driver.country) {
      setShowModal(true);
    }
  };

  const handleSelectCountry = async (countryName) => {
    try {
      const res = await fetch(
        `https://stbleague.fly.dev/api/driver/update/${driver.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: countryName }),
        }
      );
      if (!res.ok) throw new Error("Failed to update country");
      alert(`✅ Country set to ${countryName}`);
      setShowModal(false);
        onClose?.();
    } catch (err) {
      console.error(err);
      alert("Failed to update country");
    }
  };

  const nat = driver.country ?? "NAT";
  const flagPath = driver.country ? `/flags/${driver.country}.png` : null;

  return (
    <>
      {/* ======= NAT Badge ======= */}
      <div className="nat-badge" title={nat}>
        {flagPath && (
          <img
            src={flagPath}
            alt={`${nat} flag`}
            className="country-flag"
            aria-hidden="true"
          />
        )}
        <span
          className={`nat-text ${
            user?.isAdmin && !driver.country ? "clickable" : ""
          }`}
          onClick={handleClickNat}
        >
          {nat}
        </span>
      </div>

      {/* ======= Modal ======= */}
      {showModal && (
        <div className="flag-modal-backdrop" onClick={onClose}>
            <div className="flag-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Select Country</h3>
                <div className="flag-list">
                {countries.map((c) => (
                    <div
                    key={c.name}
                    className="flag-option"
                    onClick={() => handleSelectCountry(c.name)}
                    >
                    <img src={c.flag} alt={`${c.name} flag`} />
                    <span>{c.name}</span>
                    </div>
                ))}
                </div>
                <button className="close-btn" onClick={onClose}>Cancel</button>
            </div>
            </div>
      )}
    </>
  );
}
