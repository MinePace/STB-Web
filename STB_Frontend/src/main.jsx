import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import App from "./App";

import ChampionshipPage from "./Pages/Championship/ChampionshipPage";
import DriverPage from "./Pages/Driver/DriverPage";
import RaceResultPage from "./Pages/Race/RaceResult/RaceResultPage";
import HomePage from "./Pages/Home/HomePage";
import LoginPage from "./Pages/Login/LoginPage";

import AdminPage from "./Pages/Admin/AdminPage";

import AddRaceResultPage from "./Pages/Admin/AddRaceResultPage";
import EditRaceResultPage from "./Pages/Admin/EditRaceResultPage";
import AddTrackPage from "./Pages/Admin/AddTrackPage";
import AddRacePage from "./Pages/Admin/AddRacePage";
import CSVUploadPage from "./Pages/Admin/CSVUploadPage";
import EditRacePage from "./Pages/Admin/EditRacePage";
import EditTrackPage from "./Pages/Admin/EditTrackPage";

import Layout from "./Components/Layout";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Router>
    <Routes>
      <Route path="/" element={<Layout showSidebar={true}><HomePage /></Layout>} />
      <Route path="/STB/Championship/:season/:division" element={<Layout showSidebar={true}><ChampionshipPage /></Layout>} />
      <Route path="/STB/Driver/:driverName" element={<Layout showSidebar={true}><DriverPage /></Layout>} />
      <Route path="/STB/Race/:raceId" element={<Layout showSidebar={true}><RaceResultPage /></Layout>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/login" element={<Layout showSidebar={true}><LoginPage /></Layout>} />
      
      <Route path="/STB/Add/RaceResults" element={<Layout showSidebar={true}><AddRaceResultPage /></Layout>} />
      <Route path="/STB/Add/Track" element={<AddTrackPage />} />
      <Route path="/STB/Add/Race" element={<AddRacePage />} />
      <Route path="/STB/Add/CSV" element={<CSVUploadPage />} />

      <Route path="/STB/Edit/Race" element={<EditRacePage />} />
      <Route path="/STB/Edit/RaceResults" element={<Layout showSidebar={true}><EditRaceResultPage /></Layout>} />
      <Route path="/STB/Edit/Tracks" element={<Layout showSidebar={true}><EditTrackPage /></Layout>} />
    </Routes>
  </Router>
);
