/**
 * The room an open Undo toast takes at the bottom of the screen (useToastRoom), which study.css
 * turns into scroll padding and bottom padding so a focused control is never left behind it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TOAST_ROOM_ATTR, TOAST_ROOM_VAR, toastRoom } from "../../../apps/web/components/study/useToastRoom";

describe("toastRoom", () => {
  test("no toast takes no room", () => {
    expect(toastRoom([])).toBe(0);
    expect(toastRoom([{ bottom: "24px", height: 0 }])).toBe(0);
  });

  test("a toast's height plus its distance from the bottom edge, rounded up", () => {
    expect(toastRoom([{ bottom: "24px", height: 63.2 }])).toBe(88);
    // Above the phone tab bar (64 px + 20 px), a tall toast whose words wrap.
    expect(toastRoom([{ bottom: "84px", height: 204 }])).toBe(288);
  });

  test("the tallest of several regions wins", () => {
    expect(
      toastRoom([
        { bottom: "24px", height: 56 },
        { bottom: "84px", height: 156 },
      ]),
    ).toBe(240);
  });

  test("a bottom that can't be read counts the height only", () => {
    expect(toastRoom([{ bottom: "auto", height: 60 }])).toBe(60);
    expect(toastRoom([{ bottom: "", height: 60 }])).toBe(60);
    expect(toastRoom([{ bottom: "-10px", height: 60 }])).toBe(60);
  });
});

describe("study.css", () => {
  const css = readFileSync(`${process.cwd()}/apps/web/app/v3/study.css`, "utf8");

  test("uses the measured room for scroll padding and the page's bottom padding, only while a study toast is open", () => {
    expect(TOAST_ROOM_VAR).toBe("--tp-toast-room");
    expect(TOAST_ROOM_ATTR).toBe("data-tp-toast-room");
    expect(css).toContain(
      "html[data-tp-toast-room] { scroll-padding-block-end: calc(var(--tp-toast-room) + var(--tp-space-3)); }",
    );
    // Never less than the page's own bottom padding (tempo.css .tp-app__main), on a phone or wider.
    expect(css).toContain(
      "html[data-tp-toast-room] .tp-app__main { padding-block-end: max(var(--tp-space-20), calc(var(--tp-toast-room) + var(--tp-space-3))); }",
    );
    expect(css).toContain(
      "html[data-tp-toast-room] .tp-app__main { padding-block-end: max(calc(var(--tp-tabbar-h) + var(--tp-space-16)), calc(var(--tp-toast-room) + var(--tp-space-3))); }",
    );
  });
});
