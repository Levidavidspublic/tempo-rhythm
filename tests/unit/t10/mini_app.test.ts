/** MiniAppFrame helpers (kitchen T10, S24): the CSP, the srcdoc, the size cap and the message filter. */
import { describe, expect, test } from "bun:test";
import {
  buildMiniAppSrcdoc,
  clampHeight,
  isNavigationLoad,
  isTooLarge,
  MINI_APP_CSP,
  MINI_APP_MAX_BYTES,
  MINI_APP_SANDBOX,
  miniAppCspMeta,
  miniAppFingerprint,
  readMiniAppMessage,
} from "../../../apps/web/components/mini-app/mini-app";

describe("CSP", () => {
  test("shuts everything except inline script, inline style and data: images", () => {
    const directives = MINI_APP_CSP.split(";").map((d) => d.trim());
    expect(directives).toContain("default-src 'none'");
    expect(directives).toContain("script-src 'unsafe-inline'");
    expect(directives).toContain("style-src 'unsafe-inline'");
    expect(directives).toContain("img-src data:");
    expect(MINI_APP_CSP).not.toMatch(/https?:|\*|'self'|unsafe-eval|connect-src/);
  });

  test("the meta tag carries it as an http-equiv", () => {
    expect(miniAppCspMeta()).toBe(`<meta http-equiv="Content-Security-Policy" content="${MINI_APP_CSP}">`);
    expect(miniAppCspMeta(`a "b" <c>`)).toBe(
      '<meta http-equiv="Content-Security-Policy" content="a &quot;b&quot; &lt;c&gt;">',
    );
  });

  test("the srcdoc starts with the CSP, before anything the widget wrote", () => {
    const doc = buildMiniAppSrcdoc("<script>document.title='x'</script><p>Hi</p>");
    expect(doc.startsWith(`<!doctype html><meta charset="utf-8">${miniAppCspMeta()}`)).toBe(true);
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<script>"));
    expect(doc.endsWith("<p>Hi</p>")).toBe(true);
  });

  test("a widget's own doctype is dropped so the CSP still comes first", () => {
    const doc = buildMiniAppSrcdoc("<!DOCTYPE html><html><head><script>1</script></head></html>");
    expect(doc.match(/<!doctype/gi)).toHaveLength(1);
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<html>"));
  });

  test("the sandbox allows scripts and nothing else", () => {
    expect(MINI_APP_SANDBOX).toBe("allow-scripts");
  });
});

describe("size cap", () => {
  test("64 KB of UTF-8, counted in bytes", () => {
    expect(isTooLarge("a".repeat(MINI_APP_MAX_BYTES))).toBe(false);
    expect(isTooLarge("a".repeat(MINI_APP_MAX_BYTES + 1))).toBe(true);
    // Hebrew letters are two bytes each.
    expect(isTooLarge("א".repeat(MINI_APP_MAX_BYTES / 2 + 1))).toBe(true);
  });
});

describe("readMiniAppMessage", () => {
  const frame = { name: "frame window" };
  const other = { name: "another window" };

  test("accepts a size message from the frame, clamped to 80-800", () => {
    expect(readMiniAppMessage({ source: frame, data: { type: "tempo:size", height: 300 } }, frame)).toEqual({
      type: "size",
      height: 300,
    });
    expect(readMiniAppMessage({ source: frame, data: { type: "tempo:size", height: 5 } }, frame)).toEqual({
      type: "size",
      height: 80,
    });
    expect(readMiniAppMessage({ source: frame, data: { type: "tempo:size", height: 99999 } }, frame)).toEqual({
      type: "size",
      height: 800,
    });
  });

  test("accepts done from the frame", () => {
    expect(readMiniAppMessage({ source: frame, data: { type: "tempo:done" } }, frame)).toEqual({ type: "done" });
  });

  test("ignores anything from another window, or with no frame", () => {
    expect(readMiniAppMessage({ source: other, data: { type: "tempo:done" } }, frame)).toBeNull();
    expect(readMiniAppMessage({ source: null, data: { type: "tempo:done" } }, frame)).toBeNull();
    expect(readMiniAppMessage({ source: null, data: { type: "tempo:done" } }, null)).toBeNull();
  });

  test("ignores every other shape", () => {
    for (const data of [
      "tempo:done",
      null,
      [],
      { type: "tempo:size" },
      { type: "tempo:size", height: "300" },
      { type: "tempo:size", height: Number.NaN },
      { type: "tempo:size", height: Number.POSITIVE_INFINITY },
      { type: "tempo:navigate", url: "https://example.test" },
      { type: "tempo:key" },
      { type: "TEMPO:DONE" },
    ]) {
      expect(readMiniAppMessage({ source: frame, data }, frame)).toBeNull();
    }
  });

  test("clampHeight rounds", () => {
    expect(clampHeight(120.6)).toBe(121);
  });
});

describe("frame navigation and approval fingerprint", () => {
  test("the first load is the srcdoc; any later load is a navigation", () => {
    expect(isNavigationLoad(1)).toBe(false);
    expect(isNavigationLoad(2)).toBe(true);
    expect(isNavigationLoad(5)).toBe(true);
  });

  test("the fingerprint is stable for the same code and changes with any edit", () => {
    const code = "<p>Hi</p><script>parent.postMessage({type:'tempo:done'},'*')</script>";
    expect(miniAppFingerprint(code)).toBe(miniAppFingerprint(`${code}`));
    expect(miniAppFingerprint(code)).not.toBe(miniAppFingerprint(`${code} `));
    expect(miniAppFingerprint(code)).not.toBe(miniAppFingerprint(code.replace("Hi", "Ho")));
    expect(miniAppFingerprint("")).not.toBe(miniAppFingerprint("a"));
  });
});
