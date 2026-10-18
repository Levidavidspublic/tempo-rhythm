// Anti-slop Delivery Gate, Block 1 (Hard Gate) items a browser can measure, for one open page.
// Source of the gate: github.com/miqdadbadjuber/anti-slop (MIT), antislop.md "Delivery Gate".
// Used by docs/kitchen/study/shoot.mjs; the judgement items (Blocks 2-4) are written per screen
// in docs/kitchen/study/GATE.md.
//
// Each check returns { id, rule, pass, detail }. A check that can't run says so (pass: null).

/** Runs inside the page. Keep it self-contained: Playwright serialises the function. */
function measure() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  const parseRgb = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const ch = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const background = (el) => {
    let node = el;
    while (node && node.nodeType === 1) {
      const c = parseRgb(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.95) return c;
      node = node.parentElement;
    }
    return parseRgb(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };

  const textEls = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || el.closest("[aria-hidden='true'], script, style, nextjs-portal, .tp-sr-only")) continue;
    textEls.push(el);
  }
  const uniq = [...new Set(textEls)];

  const small = uniq.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
  const lowContrast = [];
  for (const el of uniq) {
    const cs = getComputedStyle(el);
    const fg = parseRgb(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const r = ratio(fg, background(el));
    if (r < need) lowContrast.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${r.toFixed(2)}<${need}`);
  }
  const text = document.body.innerText;
  const primaries = [...document.querySelectorAll(".tp-btn--primary")].filter(visible).length;
  const gradients = [...document.querySelectorAll("body *")]
    .filter((el) => visible(el) && /gradient/.test(getComputedStyle(el).backgroundImage) && !el.closest(".tp-skeleton, .tp-skel-row, .tp-page-cover"))
    .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
  const durations = [...document.querySelectorAll("body *")].flatMap((el) => {
    const cs = getComputedStyle(el);
    return [...cs.transitionDuration.split(","), ...cs.animationDuration.split(",")].map((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000));
  });
  const unnamed = [...document.querySelectorAll("button, [role=button], a[href], input, select, textarea")]
    .filter(visible)
    .filter((el) => {
      const name = (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent || el.getAttribute("title") || "").trim();
      const labelled = el.id && document.querySelector(`label[for="${el.id}"]`);
      return !name && !labelled && !el.closest("label") && el.type !== "hidden";
    })
    .map((el) => el.outerHTML.slice(0, 80));
  const deadLinks = [...document.querySelectorAll("a")].filter(visible).filter((a) => !a.getAttribute("href") || a.getAttribute("href") === "#").length;
  return {
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    small,
    lowContrast,
    emDash: text.includes("—"),
    primaries,
    gradients,
    maxMotionMs: Math.max(0, ...durations.filter(Number.isFinite)),
    unnamed,
    deadLinks,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/** Tab through the page and check that each focused control shows a ring (R-32). */
async function focusRing(page) {
  const misses = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return ring ? true : `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60);
    });
    if (r === null) break;
    if (r !== true) misses.push(r);
  }
  return misses;
}

export async function runGate(page) {
  const m = await page.evaluate(measure);
  const misses = await focusRing(page);
  return [
    { id: "R-02", rule: "no em dash in UI text", pass: !m.emDash, detail: m.emDash ? "em dash found" : "" },
    { id: "R-03", rule: "no horizontal overflow", pass: m.overflowX <= 0, detail: `overflowX=${m.overflowX}` },
    { id: "R-25", rule: "text contrast ≥ WCAG AA", pass: m.lowContrast.length === 0, detail: m.lowContrast.slice(0, 5).join("; ") },
    { id: "R-26", rule: "no unnamed or dead controls", pass: m.unnamed.length === 0 && m.deadLinks === 0, detail: [...m.unnamed.slice(0, 3), m.deadLinks ? `${m.deadLinks} link(s) without href` : ""].filter(Boolean).join("; ") },
    { id: "R-32", rule: "visible focus ring on Tab", pass: misses.length === 0, detail: misses.slice(0, 3).join("; ") },
    { id: "DESIGN-text", rule: "no text under 13 px", pass: m.small.length === 0, detail: m.small.slice(0, 3).join("; ") },
    { id: "DESIGN-accent", rule: "at most one primary button", pass: m.primaries <= 1, detail: `primaries=${m.primaries}` },
    { id: "R-01", rule: "no decorative gradients", pass: m.gradients.length === 0, detail: m.gradients.slice(0, 3).join("; ") },
    { id: "R-19", rule: "motion ≤ 250 ms", pass: m.maxMotionMs <= 250, detail: `max=${m.maxMotionMs}ms` },
  ];
}
