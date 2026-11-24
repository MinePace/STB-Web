// Base URL of the STB data API.
// Live site: VITE_API_BASE unset -> https://stbleaguedata.vercel.app
// Test site: set VITE_API_BASE in Vercel (Preview, branch "dev") to the test API.
const LIVE_API = "https://stbleaguedata.vercel.app";

export const API_BASE = (import.meta.env.VITE_API_BASE || LIVE_API).replace(/\/$/, "");

/* global __DEPLOY_ENV__ */
export const DEPLOY_ENV = typeof __DEPLOY_ENV__ !== "undefined" ? __DEPLOY_ENV__ : "development";

// Anything that is not the live deployment counts as a test site.
export const IS_TEST_SITE = DEPLOY_ENV !== "production";

// A test site without its own API would write into the live database: block that.
export const BLOCK_LIVE_WRITES = IS_TEST_SITE && API_BASE === LIVE_API;

// Read-only POSTs that are fine against the live API (logging in only checks a password).
const SAFE_POSTS = ["/api/auth/login"];

export function installTestSiteGuard() {
  if (!BLOCK_LIVE_WRITES || typeof window === "undefined" || window.__stbGuard) return;
  window.__stbGuard = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init.method || input?.method || "GET").toUpperCase();
    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (isWrite && url.startsWith(LIVE_API) && !SAFE_POSTS.some((p) => url.includes(p))) {
      const msg = "Test site: saving to the LIVE database is blocked. Nothing was saved.";
      window.alert(msg);
      return Promise.reject(new Error(msg));
    }
    return realFetch(input, init);
  };
}
