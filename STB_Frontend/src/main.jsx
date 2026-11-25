import React, { lazy, Suspense } from "react";
import "./i18n";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css"; // global base styles (the old App component was unused)

const ChampionshipPage = lazy(() => import("./Pages/Championship/ChampionshipPage"));
const DriverPage = lazy(() => import("./Pages/Driver/DriverPage"));
const RaceResultPage = lazy(() => import("./Pages/Race/RaceResult/RaceResultPage"));
import HomePage from "./Pages/Home/HomePage";
const LoginPage = lazy(() => import("./Pages/Login/LoginPage"));
const TrackPage = lazy(() => import("./Pages/Track/TrackPage"));
const HistoryPage = lazy(() => import("./Pages/History/HistoryPage"));
const StatsPage = lazy(() => import("./Pages/Stats/StatsPage"));

const AdminPage = lazy(() => import("./Pages/Admin/AdminPage"));

const AddRaceResultPage = lazy(() => import("./Pages/Admin/AddRaceResultPage"));
const EditRaceResultPage = lazy(() => import("./Pages/Admin/EditRaceResultPage"));
const AddTrackPage = lazy(() => import("./Pages/Admin/AddTrackPage"));
const AddSeasonPage = lazy(() => import("./Pages/Admin/AddSeasonPage"));
const EditSeasonPage = lazy(() => import("./Pages/Admin/EditSeasonPage"));
const EditTrackPage = lazy(() => import("./Pages/Admin/EditTrackPage"));

import Layout from "./Components/Layout";
import "./index.css";
import { IS_TEST_SITE, BLOCK_LIVE_WRITES, API_BASE, installTestSiteGuard, installFreshDataForUsers } from "./config";

installTestSiteGuard();
installFreshDataForUsers();

// Shown for the split second a page's code is being downloaded.
function PageLoading() {
  return <div className="page-loading" aria-busy="true" />;
}

function TestBanner() {
  if (!IS_TEST_SITE) return null;
  return (
    <div className="test-banner">
      TEST SITE — {BLOCK_LIVE_WRITES ? "reading live data, saving is blocked" : `data from ${API_BASE.replace(/^https?:\/\//, "")}`}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <Router>
    <TestBanner />
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<Layout showSidebar={true}><HomePage /></Layout>} />
      <Route path="/STB/Championship/:season/:division" element={<Layout showSidebar={true}><ChampionshipPage /></Layout>} />
      <Route path="/STB/Driver/:driverName" element={<Layout showSidebar={true}><DriverPage /></Layout>} />
      <Route path="/STB/Race/:raceId" element={<Layout showSidebar={true}><RaceResultPage /></Layout>} />
      <Route path="/STB/Track/:trackId" element={<Layout showSidebar={true}><TrackPage /></Layout>} />
      <Route path="/STB/History" element={<Layout showSidebar={true}><HistoryPage /></Layout>} />
      <Route path="/STB/Stats" element={<Layout showSidebar={true}><StatsPage /></Layout>} />
      <Route path="/admin" element={<Layout showSidebar={true}><AdminPage /></Layout>} />
      <Route path="/login" element={<Layout showSidebar={true}><LoginPage /></Layout>} />
      
      <Route path="/STB/Add/RaceResults" element={<Layout showSidebar={true}><AddRaceResultPage /></Layout>} />
      <Route path="/STB/Add/Track" element={<AddTrackPage />} />
      <Route path="/STB/Add/Season" element={<Layout showSidebar={true}><AddSeasonPage /></Layout>} />

      <Route path="/STB/Edit/Season" element={<Layout showSidebar={true}><EditSeasonPage /></Layout>} />
      <Route path="/STB/Edit/RaceResults" element={<Layout showSidebar={true}><EditRaceResultPage /></Layout>} />
      <Route path="/STB/Edit/Tracks" element={<Layout showSidebar={true}><EditTrackPage /></Layout>} />
    </Routes>
    </Suspense>
  </Router>
);
