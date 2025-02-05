import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import App from "./App";
import ChampionshipPage from "./Pages/Championship/ChampionshipPage";
import DriverPage from "./Pages/Driver/DriverPage";
import RaceResultPage from "./Pages/Race/RaceResultPage";
import HomePage from "./Pages/Home/HomePage";
import LoginPage from "./Pages/Login/LoginPage";
import AdminPage from "./Pages/Admin/AdminPage";

import AddRaceResultPage from "./Pages/Race/AddRaceResultPage";
import AddTrackPage from "./Pages/Track/AddTrackPage";
import AddRacePage from "./Pages/Race/AddRacePage";

import Layout from "./Components/Layout";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/STB/Championship/:season/:division" element={<Layout showSidebar={true}><ChampionshipPage /></Layout>} />
      <Route path="/STB/Driver/:driverName" element={<Layout showSidebar={true}><DriverPage /></Layout>} />
      <Route path="/STB/Race/:season/:round/:division/:type" element={<Layout showSidebar={true}><RaceResultPage /></Layout>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/STB/Add/RaceResults" element={<Layout showSidebar={true}><AddRaceResultPage /></Layout>} />
      <Route path="/STB/Add/Track" element={<AddTrackPage />} />
      <Route path="/STB/Add/Race" element={<AddRacePage />} />
    </Routes>
  </Router>
);
