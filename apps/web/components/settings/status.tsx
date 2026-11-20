"use client";

import { createContext, useContext } from "react";

/** SettingsScreen's status line (preferences: "Saved."). A no-op outside a SettingsScreen. */
export const SettingsStatusContext = createContext<(text: string) => void>(() => {});

/** Says a short line ("Saved.") in the page header's status line, if the screen has one. */
export function useSettingsStatus(): (text: string) => void {
  return useContext(SettingsStatusContext);
}
