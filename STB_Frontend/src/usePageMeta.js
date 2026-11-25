import { useEffect } from "react";

const SITE = "STB Racing League";
const DEFAULT_DESCRIPTION =
  "Results, standings and driver stats of the STB Racing League — online F1 races, live on stream.";

function setMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets the browser-tab title and the description of the current page.
 * usePageMeta("SideFx99 – Driver") -> "SideFx99 – Driver | STB Racing League".
 * Pass null/undefined while data is loading to keep the plain site name.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : SITE;
    setMeta("description", description || DEFAULT_DESCRIPTION);
  }, [title, description]);
}
