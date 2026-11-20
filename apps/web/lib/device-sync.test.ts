import { describe, expect, test } from "bun:test";
import { deviceSettingChange } from "./device-sync";
import { LANG_STORAGE_KEY } from "./i18n";
import { TEXT_SIZE_STORAGE_KEY } from "./settings/textSize";
import { DYSLEXIA_STORAGE_KEY, THEME_STORAGE_KEY } from "./theme-script";

describe("deviceSettingChange", () => {
  test("theme: light and dark as saved; a removed key is the system theme", () => {
    expect(deviceSettingChange(THEME_STORAGE_KEY, "dark")).toEqual({ kind: "theme", theme: "dark" });
    expect(deviceSettingChange(THEME_STORAGE_KEY, "light")).toEqual({ kind: "theme", theme: "light" });
    expect(deviceSettingChange(THEME_STORAGE_KEY, null)).toEqual({ kind: "theme", theme: "system" });
    expect(deviceSettingChange(THEME_STORAGE_KEY, "neon")).toEqual({ kind: "theme", theme: "system" });
  });

  test("reading font: on only when saved as on", () => {
    expect(deviceSettingChange(DYSLEXIA_STORAGE_KEY, "on")).toEqual({ kind: "dyslexia", on: true });
    expect(deviceSettingChange(DYSLEXIA_STORAGE_KEY, null)).toEqual({ kind: "dyslexia", on: false });
  });

  test("text size: small and large as saved; removed or unknown is medium", () => {
    expect(deviceSettingChange(TEXT_SIZE_STORAGE_KEY, "l")).toEqual({ kind: "textSize", size: "l" });
    expect(deviceSettingChange(TEXT_SIZE_STORAGE_KEY, "s")).toEqual({ kind: "textSize", size: "s" });
    expect(deviceSettingChange(TEXT_SIZE_STORAGE_KEY, null)).toEqual({ kind: "textSize", size: "m" });
  });

  test("language: only en and he are followed", () => {
    expect(deviceSettingChange(LANG_STORAGE_KEY, "he")).toEqual({ kind: "lang", lang: "he" });
    expect(deviceSettingChange(LANG_STORAGE_KEY, "en")).toEqual({ kind: "lang", lang: "en" });
    expect(deviceSettingChange(LANG_STORAGE_KEY, "fr")).toBeNull();
    expect(deviceSettingChange(LANG_STORAGE_KEY, null)).toBeNull();
  });

  test("other keys (and localStorage.clear(), whose key is null) change nothing", () => {
    expect(deviceSettingChange("__convexAuthJWT_x", "token")).toBeNull();
    expect(deviceSettingChange(null, null)).toBeNull();
  });
});
