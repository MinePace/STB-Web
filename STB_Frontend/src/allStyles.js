// All style sheets, loaded up front in one fixed order (the order they had before pages
// were split). Pages rely on this cascade: some reuse classes from other pages, and
// index.css must come last so its theme variables win. Page *code* still loads on demand.
import "./App.css";
import "./Pages/Championship/ChampionshipPage.css";
import "./Components/Links.css";
import "./Components/Loaders/RaceLoader.css";
import "./Pages/Driver/DriverPage.css";
import "./Components/Loaders/DriverLoader.css";
import "./Pages/Race/RaceResult/RaceResultPage.css";
import "./Pages/Home/HomePage.css";
import "./Pages/Login/LoginPage.css";
import "./Pages/Track/TrackPage.css";
import "./Pages/History/HistoryPage.css";
import "./Pages/Stats/StatsPage.css";
import "./Pages/Admin/AdminPage.css";
import "./Pages/Admin/AddRaceResultPage.css";
import "./Pages/Admin/ScreenshotAssist.css";
import "./Pages/Admin/EditRaceResultPage.css";
import "./Pages/Admin/AddSeasonPage.css";
import "./Pages/Admin/EditSeasonPage.css";
import "./Components/Topbar.css";
import "./Components/Layout.css";
import "./index.css";
