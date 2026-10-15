"use client";

import { useEffect, useState } from "react";

/**
 * The browser's online flag, for the v3 offline notice (DESIGN.md "Common to every screen":
 * alert). Starts true so the server render and the first client render agree.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
