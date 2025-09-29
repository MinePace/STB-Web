import { useEffect } from "react";

export function useShortcut(key, callback, options = {}) {
  useEffect(() => {
    const handler = (e) => {
      // Niet triggeren als iemand in een invoerveld bezig is
      if (
        ["INPUT", "TEXTAREA"].includes(e.target.tagName) ||
        e.target.isContentEditable
      ) {
        return;
      }

      const matchKey = e.key.toLowerCase() === key.toLowerCase();
      const matchCtrl = options.ctrl ? e.ctrlKey : true;
      const matchAlt = options.alt ? e.altKey : true;
      const matchShift = options.shift ? e.shiftKey : true;
      const matchCaps = options.caps ? e.getModifierState("CapsLock") : true;

      if (matchKey && matchCtrl && matchAlt && matchShift && matchCaps) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, options]);
}
