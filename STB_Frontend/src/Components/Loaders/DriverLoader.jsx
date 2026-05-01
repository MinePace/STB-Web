import "./DriverLoader.css";
import { useTranslation } from "react-i18next";

function DriverLoader() {
  const { t } = useTranslation();

  return (
    <div className="driver-loader-container">
      <div className="driver-loader-card">

        <div className="driver-loader-header">
          <div className="driver-loader-flag shimmer" />
          <div className="driver-loader-name shimmer" />
        </div>

        <div className="driver-loader-panels">
          <div className="driver-loader-panel shimmer" />
          <div className="driver-loader-panel shimmer" />
          <div className="driver-loader-panel shimmer" />
        </div>

        <div className="driver-loader-subtext">
          {t("loader.driver.loading")}
          <span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>

      </div>
    </div>
  );
}

export default DriverLoader;