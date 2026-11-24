// Team colours (bar next to the team name) and logo paths, shared by all pages.
export const TEAM_COLORS = {
  "Red Bull": "rgba(59, 73, 149, 1)",
  "Mercedes": "rgb(109, 230, 205)",
  "Ferrari": "rgb(231, 0, 0)",
  "McLaren": "rgb(255, 145, 19)",
  "Alpine": "rgb(15, 148, 250)",
  "Alpha Tauri": "rgb(65, 102, 126)",
  "Aston Martin": "rgb(43, 99, 85)",
  "Williams": "rgb(1, 90, 255)",
  "Haas": "rgb(178, 182, 185)",
  "Renault": "rgb(243, 240, 37)",
  "Alfa Romeo": "rgb(136, 1, 1)",
  "Manor": "rgb(12, 211, 247)",
  "Sauber": "rgb(18, 79, 160)",
  "Force India": "rgba(246, 185, 43, 1)",
  "Racing Point": "rgb(255, 130, 234)",
  "Toro Rosso": "rgb(0, 44, 238)",
  "RB": "rgb(0, 44, 238)",
  "KICK": "rgb(25, 225, 52)",
  "Racing Bulls": "rgba(246, 253, 255, 1)",
  "Audi": "",
  "Cadillac": "",
};

export const teamColor = (name) => TEAM_COLORS[String(name || "").trim()] || "var(--muted-fg)";
export const teamLogo = (name) => `/team-logos/${String(name || "").trim()}.png`;
