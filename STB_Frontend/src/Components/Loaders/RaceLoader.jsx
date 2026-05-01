import "./RaceLoader.css";
import { useTranslation } from "react-i18next";

function RaceLoader({ season, division}) {
  const { t } = useTranslation();
  return (
    <div className="race-loader-container">
      <div className="race-loader-card">

        <div className="race-loader-title">
          STB Championship
        </div>

        {(season || division) && (
          <div className="race-loader-meta">
            {season && `${t("loader.race.season")} ${season}`} 
            {season && division && " • "}
            {division && `${t("loader.race.division")} ${division}`}
          </div>
        )}

        <div className="race-loader-bar">
          <div className="race-loader-stripe"></div>
        </div>

        <div className="race-loader-text">
          {t("loader.race.loading")}
          <span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>

      </div>
    </div>
  );
}

export default RaceLoader;