import "./RaceLoader.css";

function RaceLoader({ season, division, text = "Loading Championship Data..." }) {
  return (
    <div className="race-loader-container">
      <div className="race-loader-card">

        <div className="race-loader-title">
          STB Championship
        </div>

        {(season || division) && (
          <div className="race-loader-meta">
            {season && `Season ${season}`} 
            {season && division && " • "}
            {division && `Tier ${division}`}
          </div>
        )}

        <div className="race-loader-bar">
          <div className="race-loader-stripe"></div>
        </div>

        <div className="race-loader-text">
          {text}
          <span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>

      </div>
    </div>
  );
}

export default RaceLoader;