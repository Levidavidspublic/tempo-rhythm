import { describe, expect, test } from "bun:test";
import { THEME_STORAGE_KEY, themeInitScript } from "./theme-script";

/** Runs the pre-hydration script against a fake document, location and storage. */
function run(search: string, stored: Record<string, string>) {
  const attrs: Record<string, string> = {};
  const root = {
    lang: "",
    dir: "",
    setAttribute: (name: string, value: string) => {
      attrs[name] = value;
    },
    removeAttribute: (name: string) => {
      delete attrs[name];
    },
  };
  const localStorage = { getItem: (key: string) => stored[key] ?? null };
  new Function("document", "location", "localStorage", themeInitScript())(
    { documentElement: root },
    { search },
    localStorage,
  );
  return { theme: attrs["data-theme"], lang: root.lang, dir: root.dir };
}

describe("themeInitScript", () => {
  test("a valid ?theme= wins over the stored theme", () => {
    expect(run("?theme=dark", { [THEME_STORAGE_KEY]: "light" }).theme).toBe("dark");
  });

  test("an invalid ?theme= falls back to the stored theme", () => {
    expect(run("?theme=bogus", { [THEME_STORAGE_KEY]: "dark" }).theme).toBe("dark");
    expect(run("?theme=", { [THEME_STORAGE_KEY]: "light" }).theme).toBe("light");
  });

  test("an invalid ?lang= falls back to the stored language", () => {
    expect(run("?lang=fr", { "tempo-lang": "he" })).toMatchObject({ lang: "he", dir: "rtl" });
    expect(run("?lang=en", { "tempo-lang": "he" })).toMatchObject({ lang: "en", dir: "ltr" });
  });
});
