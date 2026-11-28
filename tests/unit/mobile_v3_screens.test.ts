import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const MOBILE = join(ROOT, "apps/mobile");

/** The 13 v3 mobile screens and where each one lives in the Expo Router tree. */
const SCREENS = [
  ["today", "app/(tempo)/(tabs)/today.tsx"],
  ["capture", "app/(tempo)/capture.tsx"],
  ["coach", "app/(tempo)/(tabs)/coach.tsx"],
  ["voice-call", "app/(tempo)/voice-call.tsx"],
  ["tasks", "app/(tempo)/(tabs)/tasks.tsx"],
  ["notes", "app/(tempo)/(tabs)/notes.tsx"],
  ["journal", "app/(tempo)/journal.tsx"],
  ["habits", "app/(tempo)/habits.tsx"],
  ["calendar", "app/(tempo)/calendar.tsx"],
  ["routines", "app/(tempo)/routines.tsx"],
  ["templates", "app/(tempo)/templates.tsx"],
  ["settings", "app/(tempo)/settings.tsx"],
  ["onboarding", "app/(auth)/onboarding.tsx"],
] as const;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? files(abs) : /\.(ts|tsx)$/.test(name) ? [abs] : [];
  });
}

describe("v3 mobile screens", () => {
  test.each([...SCREENS])("%s exists, default-exports a screen and names its design file", (id, path) => {
    const source = readFileSync(join(MOBILE, path), "utf8");
    expect(source).toMatch(/export default function \w+/);
    expect(source).toContain(`docs/design/v3/screens/mobile/${id}.html`);
  });

  test("the stack declares the voice call and the page route", () => {
    const layout = readFileSync(join(MOBILE, "app/(tempo)/_layout.tsx"), "utf8");
    expect(layout).toContain('name="voice-call"');
    expect(layout).toContain('name="page/[id]"');
    expect(readFileSync(join(MOBILE, "app/(tempo)/page/[id].tsx"), "utf8")).toMatch(/export default function \w+/);
  });

  test("the tab bar has Today, Tasks, Coach, Notes and More", () => {
    const bar = readFileSync(join(MOBILE, "components/v3/TabBar.tsx"), "utf8");
    for (const key of ["tab.today", "tab.tasks", "tab.coach", "tab.notes", "tab.more"]) expect(bar).toContain(key);
  });
});

describe("v3 mobile code stays on tokens and on its own app", () => {
  const roots = ["app/(tempo)", "components/v3", "lib/v3"].map((r) => join(MOBILE, r));
  const sources = [...roots.flatMap(files), join(MOBILE, "app/(auth)/onboarding.tsx")];

  test("no raw colours outside the token files", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect([file, text.match(/["'`]#[0-9a-fA-F]{3,8}\b|rgba?\(/g)]).toEqual([file, null]);
    }
  });

  test("nothing imports from apps/web", () => {
    for (const file of sources) {
      expect([file, /from ["'][^"']*apps\/web/.test(readFileSync(file, "utf8"))]).toEqual([file, false]);
    }
  });

  test("pure v3 logic never imports React Native", () => {
    for (const file of files(join(MOBILE, "lib/v3"))) {
      expect([file, /from ["']react-native["']/.test(readFileSync(file, "utf8"))]).toEqual([file, false]);
    }
  });
});
