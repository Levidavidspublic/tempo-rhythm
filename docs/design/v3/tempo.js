/* ============================================================
   Tempo v3 — shared behaviour (vanilla, no build)
   - Preferences: theme, language/direction, dyslexia, text size
     from URL (?theme=dark&lang=he&dyslexia=on&size=l&state=undo)
     then localStorage (tempo-theme, tempo-dyslexia, tempo-lang).
   - i18n: [data-i18n] text, [data-i18n-attr="aria-label:key;placeholder:key"].
     Each screen defines window.TP_STRINGS = { en: {...}, he: {...} }.
   - Icons: one 1.5px line family injected as an SVG sprite.
   - Components: CheckTask, EnergyDial, SlashMenu, CoachPanel,
     ProposalCard (Accept / Edit / Reject), UndoToast (5 min).
   ============================================================ */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var params = new URLSearchParams(location.search);
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var TP = window.TP = window.TP || {};

  /* ---------- Icons ------------------------------------------- */
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    page: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 12.5h6M9.5 16h4"/>',
    today: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><circle cx="12" cy="15" r="1.5"/>',
    inbox: '<path d="M4 13.5l2.5-8h11l2.5 8v5H4z"/><path d="M4 13.5h5l1 2h4l1-2h5"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    template: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M9.5 9.5V20"/>',
    chevron: '<path d="M9.5 6l6 6-6 6"/>',
    down: '<path d="M6 9.5l6 6 6-6"/>',
    grip: '<circle cx="9" cy="6.5" r="1"/><circle cx="15" cy="6.5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17.5" r="1"/><circle cx="15" cy="17.5" r="1"/>',
    coach: '<path d="M4.5 12a7.5 7.5 0 1 1 3.4 6.3L4.5 19.5l1.2-3.4A7.5 7.5 0 0 1 4.5 12z"/><path d="M9 11h6M9 14h3.5"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
    hash: '<path d="M9 4L7.5 20M16.5 4L15 20M4.5 9h15M4 15h15"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    text: '<path d="M5 6.5h14M12 6.5v12"/>',
    heading: '<path d="M6 5v14M16 5v14M6 12h10M19 19v-6l-2 1"/>',
    list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.75" cy="7" r=".75"/><circle cx="4.75" cy="12" r=".75"/><circle cx="4.75" cy="17" r=".75"/>',
    checklist: '<path d="M4 7l1.5 1.5L8.5 5.5M4 15l1.5 1.5 3-3M11.5 7.5h8.5M11.5 15.5h8.5"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    timeblock: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 14h5"/>',
    habit: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5V9h-4.5"/>',
    energy: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l3.5-4.5"/><circle cx="12" cy="16" r="1"/>',
    nag: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    more: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    edit: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    type: '<path d="M4 18L9 6l5 12M5.8 14h6.4M15.5 18v-5.5a2.5 2.5 0 0 1 5 0V18M15.5 15h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    /* ---- Stage 2 icons (same 24 grid, 1.5px line). "list" already exists above. ---- */
    phone: '<path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z"/>',
    "phone-off": '<path d="M6.5 4h3l1.5 4-2 1.5c.5 1.2 1.2 2.3 2 3.2M14.5 15l1-1.5 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 8 15.5"/><path d="M4 4l16 16"/>',
    volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    waveform: '<path d="M4 12h1.5M7.5 9v6M11 6v12M14.5 8.5v7M18 10.5v3M20 12h.5"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9M12 8v4.5l3 1.5"/>',
    memory: '<path d="M12 5.5a3 3 0 0 0-5.5 1.2A3 3 0 0 0 5 12a3 3 0 0 0 2 4.8A3 3 0 0 0 12 18.5z"/><path d="M12 5.5a3 3 0 0 1 5.5 1.2A3 3 0 0 1 19 12a3 3 0 0 1-2 4.8 3 3 0 0 1-5 1.7M12 5.5v13"/>',
    module: '<path d="M9.5 4.5h5v2a1.5 1.5 0 0 0 3 0v-2h2v5h-2a1.5 1.5 0 0 0 0 3h2v7h-5v-2a1.5 1.5 0 0 0-3 0v2h-5v-5h2a1.5 1.5 0 0 0 0-3h-2v-7z"/>',
    "calendar-grid": '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16M9.3 10v10M14.7 10v10M4 15h16"/>',
    kanban: '<rect x="3.5" y="4.5" width="5" height="15" rx="1.5"/><rect x="9.5" y="4.5" width="5" height="10" rx="1.5"/><rect x="15.5" y="4.5" width="5" height="12.5" rx="1.5"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
    star: '<path d="M12 4l2.5 5.2 5.5.7-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.7z"/>',
    flag: '<path d="M6 20.5V4.5M6 5h11l-2 4 2 4H6"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.5v4h-4M6 20.5v-4h4"/>',
    "wifi-off": '<path d="M4 4l16 16"/><path d="M2.5 9a14 14 0 0 1 4.3-2.6M10.5 5.6A14 14 0 0 1 21.5 9M5.5 12.5a9 9 0 0 1 3.8-2.1M14.8 10.6a9 9 0 0 1 3.7 1.9M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="19" r=".75"/>',
    heart: '<path d="M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/>',
    alert: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16" r=".75"/>',
    info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".75"/>',
    minus: '<path d="M5 12h14"/>',
    pin: '<path d="M12 20.5s6-5.5 6-10.5a6 6 0 0 0-12 0c0 5 6 10.5 6 10.5z"/><circle cx="12" cy="10" r="2.25"/>',
    "mic-off": '<path d="M15 10V6.5a3 3 0 0 0-5.8-1M9 9v2.5a3 3 0 0 0 4.6 2.5M5.5 11.5a6.5 6.5 0 0 0 10.6 5M18.5 11.5c0 .8-.1 1.5-.4 2.2M12 18v3M4 4l16 16"/>',
    hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7.5a7 7 0 0 1-7 7 6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
    sort: '<path d="M7 4.5v15M4 16.5l3 3 3-3M17 19.5v-15M14 7.5l3-3 3 3"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    lifebuoy: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2"/>',
    card: '<rect x="3.5" y="6" width="14" height="11" rx="2"/><path d="M7 3.5h11.5a2 2 0 0 1 2 2V14"/>',
    question: '<circle cx="12" cy="12" r="8"/><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.7-2.2 2-2.2 3.5"/><circle cx="12" cy="16.5" r=".75"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    logout: '<path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14"/><path d="M10.5 12H20M16.5 8.5L20 12l-3.5 3.5"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>',
    sparkle: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/>'
  };
  function injectSprite() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">';
    Object.keys(ICONS).forEach(function (k) { s += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONS[k] + '</symbol>'; });
    s += '</svg>';
    var wrap = doc.createElement("div"); wrap.innerHTML = s; doc.body.insertBefore(wrap.firstChild, doc.body.firstChild);
  }
  TP.icon = function (name, cls) {
    return '<svg class="tp-icon ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };

  /* ---------- Preferences ------------------------------------- */
  function applyPrefs() {
    var theme = params.get("theme") || store.get("tempo-theme") || "system";
    if (theme === "system") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.setAttribute("data-theme", theme);

    var lang = params.get("lang") || store.get("tempo-lang") || "en";
    root.lang = lang;
    root.dir = (params.get("dir") || (lang === "he" || lang === "ar" || lang === "fa" ? "rtl" : "ltr"));

    var dys = params.get("dyslexia") || store.get("tempo-dyslexia") || "off";
    root.setAttribute("data-dyslexia", dys);
    var size = params.get("size") || store.get("tempo-text-size");
    if (size) root.setAttribute("data-text-size", size);
    if (params.get("glass") === "off") root.setAttribute("data-glass", "off");

    if (!(window.CSS && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)")))) root.setAttribute("data-glass", "off");
  }
  TP.setTheme = function (t) { store.set("tempo-theme", t); root.setAttribute("data-theme", t); syncToggles(); };
  TP.setDyslexia = function (on) {
    store.set("tempo-dyslexia", on ? "on" : "off");
    root.setAttribute("data-dyslexia", on ? "on" : "off");
    checkDyslexiaFont(); syncToggles();
  };
  function checkDyslexiaFont() {
    if (root.getAttribute("data-dyslexia") !== "on" || !doc.fonts || !doc.fonts.load) return;
    doc.fonts.load('17px "OpenDyslexic"').then(function (faces) {
      if (!faces || !faces.length) root.setAttribute("data-dyslexia-font", "fallback");
    }).catch(function () { root.setAttribute("data-dyslexia-font", "fallback"); });
  }

  /* ---------- i18n -------------------------------------------- */
  function t(key) {
    var S = window.TP_STRINGS || {}, lang = root.lang;
    return (S[lang] && S[lang][key] != null) ? S[lang][key] : (S.en && S.en[key] != null ? S.en[key] : null);
  }
  TP.t = function (key) { var v = t(key); return v == null ? key : v; };
  function applyStrings(scope) {
    (scope || doc).querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n")); if (v != null) el.textContent = v;
    });
    (scope || doc).querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = v;
    });
    (scope || doc).querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"); var v = t(p[1]); if (v != null) el.setAttribute(p[0].trim(), v);
      });
    });
    var title = t("doc.title"); if (title) doc.title = title;
  }

  /* ---------- Toggles (theme / dyslexia) ---------------------- */
  function syncToggles() {
    doc.querySelectorAll('[data-action="toggle-theme"]').forEach(function (b) {
      var dark = root.getAttribute("data-theme") === "dark";
      b.setAttribute("aria-pressed", String(dark));
      var use = b.querySelector("use"); if (use) use.setAttribute("href", dark ? "#i-sun" : "#i-moon");
    });
    doc.querySelectorAll('[data-action="toggle-dyslexia"]').forEach(function (b) {
      b.setAttribute("aria-pressed", String(root.getAttribute("data-dyslexia") === "on"));
    });
  }

  /* ---------- Task check (optimistic) ------------------------- */
  function onCheck(btn) {
    var on = btn.getAttribute("aria-checked") !== "true";
    btn.setAttribute("aria-checked", String(on));
    var row = btn.closest(".tp-task-row"); if (row) row.setAttribute("data-done", String(on));
  }

  /* ---------- Segmented (radio group) ------------------------- */
  function onSeg(opt) {
    var group = opt.closest('[role="radiogroup"]');
    group.querySelectorAll('[role="radio"]').forEach(function (o) {
      var sel = o === opt; o.setAttribute("aria-checked", String(sel)); o.tabIndex = sel ? 0 : -1;
    });
  }
  function segKeys(e) {
    var opt = e.target.closest('[role="radio"]'); if (!opt) return;
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    var dir = keys[e.key]; if (root.dir === "rtl" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) dir = -dir;
    var opts = Array.prototype.slice.call(opt.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]'));
    var next = opts[(opts.indexOf(opt) + dir + opts.length) % opts.length];
    e.preventDefault(); onSeg(next); next.focus();
  }

  /* ---------- Slash menu (listbox) ---------------------------- */
  function slashKeys(e) {
    var menu = doc.querySelector(".tp-slash-menu:not([hidden])"); if (!menu) return;
    var items = Array.prototype.slice.call(menu.querySelectorAll('[role="option"]'));
    var cur = items.findIndex(function (i) { return i.getAttribute("aria-selected") === "true"; });
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var n = (cur + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      selectOption(menu, items[n]);
    } else if (e.key === "Enter" && cur > -1) {
      e.preventDefault(); chooseOption(items[cur]);
    } else if (e.key === "Escape") {
      closeSlash(menu);
    }
  }
  function selectOption(menu, item) {
    menu.querySelectorAll('[role="option"]').forEach(function (i) { i.setAttribute("aria-selected", String(i === item)); });
    var list = menu.querySelector('[role="listbox"]'); if (list) list.setAttribute("aria-activedescendant", item.id);
    item.scrollIntoView({ block: "nearest" });
  }
  function chooseOption(item) {
    var menu = item.closest(".tp-slash-menu");
    var anchor = doc.querySelector(".tp-slash-anchor");
    if (anchor) {
      var line = anchor.querySelector(".tp-slash-line");
      if (line) line.innerHTML = '<span class="tp-muted">' + item.querySelector(".tp-slash-item__name").textContent + '</span> <span class="tp-caret" aria-hidden="true"></span>';
    }
    closeSlash(menu);
  }
  function closeSlash(menu) {
    menu.hidden = true;
    var input = doc.querySelector("[aria-controls='" + menu.id + "']");
    if (input) { input.setAttribute("aria-expanded", "false"); input.focus(); }
  }

  /* ---------- Coach panel ------------------------------------- */
  var lastFocus = null;
  TP.openCoach = function () {
    var app = doc.querySelector(".tp-app"); if (!app) return;
    lastFocus = doc.activeElement;
    app.setAttribute("data-coach", "open");
    var panel = doc.querySelector(".tp-coach-panel"); if (panel) { panel.hidden = false; var f = panel.querySelector("textarea, button"); if (f) f.focus(); }
    doc.querySelectorAll('[data-action="open-coach"]').forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
  };
  TP.closeCoach = function () {
    var app = doc.querySelector(".tp-app"); if (!app) return;
    app.removeAttribute("data-coach");
    var panel = doc.querySelector(".tp-coach-panel"); if (panel) panel.hidden = true;
    doc.querySelectorAll('[data-action="open-coach"]').forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  /* ---------- Proposal card + Undo toast ---------------------- */
  var UNDO_MS = 5 * 60 * 1000;
  TP.acceptProposal = function (card, opts) {
    if (!card || card.getAttribute("data-status") === "accepted") return;
    card.setAttribute("data-status", "accepted");
    card.querySelectorAll('[contenteditable="true"]').forEach(function (el) { el.removeAttribute("contenteditable"); });
    var note = card.querySelector(".tp-proposal__note");
    if (note) { note.hidden = false; note.querySelector("[data-note]").textContent = TP.t("proposal.accepted"); }
    if (typeof TP.onAccept === "function") TP.onAccept(card);
    showUndo(card, opts && opts.elapsed);
  };
  TP.rejectProposal = function (card) {
    card.setAttribute("data-status", "rejected");
    var note = card.querySelector(".tp-proposal__note");
    if (note) { note.hidden = false; note.querySelector("[data-note]").textContent = TP.t("proposal.rejected"); }
  };
  TP.editProposal = function (card, btn) {
    var editing = btn.getAttribute("aria-pressed") === "true";
    card.querySelectorAll(".tp-change__title").forEach(function (el) {
      if (editing) el.removeAttribute("contenteditable"); else el.setAttribute("contenteditable", "true");
    });
    btn.setAttribute("aria-pressed", String(!editing));
    var lbl = btn.querySelector("[data-i18n]"); if (lbl) lbl.textContent = TP.t(editing ? "proposal.edit" : "proposal.doneEditing");
    if (!editing) { var first = card.querySelector(".tp-change__title"); if (first) first.focus(); }
  };
  function fmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function showUndo(card, elapsed) {
    var region = doc.querySelector(".tp-toast-region"); if (!region) return;
    region.innerHTML = "";
    var el = doc.createElement("div");
    el.className = "tp-toast tp-glass"; el.setAttribute("data-component", "UndoToast"); el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="tp-toast__icon">' + TP.icon("check") + '</span>' +
      '<span class="tp-toast__text"><span class="tp-toast__title">' + TP.t("toast.title") + '</span>' +
      '<span class="tp-toast__sub">' + TP.t("toast.sub") + ' <span class="tp-num tp-mono" data-countdown></span></span></span>' +
      '<button class="tp-btn tp-btn--secondary tp-btn--sm" type="button" data-action="undo">' + TP.icon("undo", "tp-icon--sm") + '<span>' + TP.t("toast.undo") + '</span></button>' +
      '<button class="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon" type="button" data-action="dismiss-toast" aria-label="' + TP.t("toast.dismiss") + '">' + TP.icon("x", "tp-icon--sm") + '</button>';
    region.appendChild(el);
    var end = Date.now() + UNDO_MS - (elapsed || 0);
    var cd = el.querySelector("[data-countdown]");
    function tick() {
      var left = end - Date.now(); cd.textContent = fmt(left);
      if (left <= 0) { clearInterval(timer); dismiss(el); }
    }
    var timer = setInterval(tick, 1000); tick();
    el._timer = timer; el._card = card;
  }
  function dismiss(el) {
    clearInterval(el._timer); el.setAttribute("data-leaving", "");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  }
  function undo(el) {
    var card = el._card;
    if (card) {
      card.setAttribute("data-status", "pending");
      var note = card.querySelector(".tp-proposal__note"); if (note) note.hidden = true;
      if (typeof TP.onUndo === "function") TP.onUndo(card);
    }
    dismiss(el);
    var a = card && card.querySelector('[data-action="accept"]'); if (a) a.focus();
  }

  /* ---------- Rail drawer (small screens) --------------------- */
  function toggleRail(open) {
    var app = doc.querySelector(".tp-app"); if (!app) return;
    if (open) app.setAttribute("data-rail", "open"); else app.removeAttribute("data-rail");
    doc.querySelectorAll('[data-action="toggle-rail"]').forEach(function (b) { b.setAttribute("aria-expanded", String(!!open)); });
    if (open) { var f = doc.querySelector(".tp-rail a, .tp-rail button"); if (f) f.focus(); }
  }

  /* ---------- Delegated events -------------------------------- */
  function onClick(e) {
    var a = e.target.closest("[data-action]");
    if (a) {
      var act = a.getAttribute("data-action");
      if (act === "check") onCheck(a);
      else if (act === "toggle-theme") TP.setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      else if (act === "toggle-dyslexia") TP.setDyslexia(root.getAttribute("data-dyslexia") !== "on");
      else if (act === "open-coach") TP.openCoach();
      else if (act === "close-coach") TP.closeCoach();
      else if (act === "accept") TP.acceptProposal(a.closest(".tp-proposal"));
      else if (act === "reject") TP.rejectProposal(a.closest(".tp-proposal"));
      else if (act === "edit") TP.editProposal(a.closest(".tp-proposal"), a);
      else if (act === "undo") undo(a.closest(".tp-toast"));
      else if (act === "dismiss-toast") dismiss(a.closest(".tp-toast"));
      else if (act === "toggle-rail") toggleRail(!doc.querySelector('.tp-app[data-rail="open"]'));
      else if (act === "scrim") { toggleRail(false); TP.closeCoach(); }
      else if (act === "noop") e.preventDefault();
      return;
    }
    var opt = e.target.closest('[role="radio"]'); if (opt) { onSeg(opt); return; }
    var item = e.target.closest('.tp-slash-menu [role="option"]'); if (item) { chooseOption(item); return; }
    var inert = e.target.closest('a[href="#"]'); if (inert) e.preventDefault();
  }
  function onKey(e) {
    if (e.key === "Escape") {
      if (doc.querySelector('.tp-app[data-rail="open"]')) { toggleRail(false); return; }
      if (doc.querySelector('.tp-app[data-coach="open"]') && !doc.querySelector(".tp-slash-menu:not([hidden])")) { TP.closeCoach(); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); TP.openCoach(); return; }
    segKeys(e); slashKeys(e);
  }

  /* ---------- Boot -------------------------------------------- */
  applyPrefs();
  function boot() {
    injectSprite();
    applyStrings();
    syncToggles();
    checkDyslexiaFont();
    doc.addEventListener("click", onClick);
    doc.addEventListener("keydown", onKey);
    if (typeof TP.onReady === "function") TP.onReady(params);
    var state = params.get("state");
    if (state === "undo") {
      var card = doc.querySelector(".tp-proposal");
      if (card) TP.acceptProposal(card, { elapsed: 6000 });
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})();


/* ================================================================
   STAGE 2 BEHAVIOUR (Build Package P0-foundation · 12 Oct 2026)
   ----------------------------------------------------------------
   Appended after the Stage 1 IIFE. The Stage 1 TP API is untouched;
   this block only ADDS to window.TP. Vanilla, no build, no deps.
   Every function says: which component, which real backend call it
   stands for (REAL: ...), and what state it changes (STATE: ...).
   Strings: screens may define keys in window.TP_STRINGS; each call
   below has an English fallback so a screen never shows a raw key.
   ================================================================ */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var TP = window.TP = window.TP || {};
  var params = new URLSearchParams(location.search);
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** L(key, fallback) — i18n lookup with an English fallback.
   *  STATE: none. Uses Stage 1 TP.t when present. */
  function L(key, fallback) {
    if (typeof TP.t !== "function") return fallback;
    var v = TP.t(key); return (v == null || v === key) ? fallback : v;
  }
  function icon(name, cls) { return typeof TP.icon === "function" ? TP.icon(name, cls) : ""; }
  function $(sel, scope) { return (scope || doc).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function announce(text) {
    /* Shared polite live region for move / forget / toggle messages. */
    var r = $("#tp-live");
    if (!r) { r = doc.createElement("div"); r.id = "tp-live"; r.className = "tp-sr-only"; r.setAttribute("aria-live", "polite"); doc.body.appendChild(r); }
    r.textContent = ""; setTimeout(function () { r.textContent = text; }, 30);
  }

  /* ---------- State switch ------------------------------------- */
  /**
   * StateSwitch — reads ?state=empty|loading|error|offline and sets html[data-state].
   * REAL: none (demo only). In the app the state comes from the Convex query result:
   *   useQuery(...) === undefined -> loading · [] -> empty · throws -> error · navigator.onLine false -> offline.
   * STATE: html[data-state] = "default" | "empty" | "loading" | "error" | "offline".
   * CSS contract (tempo.css, STAGE 2 > StateSwitch):
   *   [data-state-show~="X"] shows only in state X; [data-state-hide] hides in empty/loading/error;
   *   offline keeps content and shows [data-state-show~="offline"] (the offline banner).
   * Note: ?state=undo is a Stage 1 coach demo and maps to "default" here.
   */
  var STATES = ["default", "empty", "loading", "error", "offline"];
  TP.setState = function (s) {
    if (STATES.indexOf(s) === -1) s = "default";
    root.setAttribute("data-state", s);
    if (s === "loading") root.setAttribute("aria-busy", "true"); else root.removeAttribute("aria-busy");
  };
  TP.setState(params.get("state"));

  /* ---------- Generic toast with Undo (reuses Stage 1 markup) --- */
  /**
   * TP.toast({ title, sub?, undoMs?, onUndo? }) — UndoToast for non-proposal changes
   * (forget a memory, move a card, voice action). Same markup and classes as Stage 1.
   * REAL: sonner toast; the undo calls the matching Convex "restore" mutation.
   * STATE: one .tp-toast in .tp-toast-region; Stage 1 handles data-action="undo"/"dismiss-toast"
   *        (it dismisses); this block runs el._onUndo on the same click.
   */
  TP.toast = function (opts) {
    opts = opts || {};
    var region = $(".tp-toast-region");
    if (!region) { region = doc.createElement("div"); region.className = "tp-toast-region"; region.setAttribute("aria-live", "polite"); doc.body.appendChild(region); }
    region.innerHTML = "";
    var el = doc.createElement("div");
    el.className = "tp-toast tp-glass"; el.setAttribute("data-component", "UndoToast"); el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="tp-toast__icon">' + icon("check") + '</span>' +
      '<span class="tp-toast__text"><span class="tp-toast__title"></span>' +
      '<span class="tp-toast__sub"><span data-sub></span> <span class="tp-num tp-mono" data-countdown></span></span></span>' +
      (opts.onUndo ? '<button class="tp-btn tp-btn--secondary tp-btn--sm" type="button" data-action="undo">' + icon("undo", "tp-icon--sm") + '<span>' + L("toast.undo", "Undo") + '</span></button>' : "") +
      '<button class="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon" type="button" data-action="dismiss-toast" aria-label="' + L("toast.dismiss", "Dismiss") + '">' + icon("x", "tp-icon--sm") + '</button>';
    el.querySelector(".tp-toast__title").textContent = opts.title || L("toast.title", "Done");
    el.querySelector("[data-sub]").textContent = opts.sub || (opts.onUndo ? L("toast.sub", "You can undo for") : "");
    region.appendChild(el);
    var end = Date.now() + (opts.undoMs || 5 * 60 * 1000), cd = el.querySelector("[data-countdown]");
    function tick() {
      var left = Math.max(0, end - Date.now()), s = Math.ceil(left / 1000);
      cd.textContent = opts.onUndo ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "";
      if (left <= 0) { clearInterval(el._timer); el.setAttribute("data-leaving", ""); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200); }
    }
    el._timer = setInterval(tick, 1000); tick();
    el._onUndo = opts.onUndo || null;
    return el;
  };

  /* ---------- Switch (role=switch) ----------------------------- */
  /**
   * Switch — <button class="tp-switch" role="switch" aria-checked> with .tp-switch__state word.
   * REAL: whatever the row controls, e.g. profiles.updatePrefs({ key, value }) or modules.setEnabled({ id, on }).
   * STATE: aria-checked; the On/Off word; plus ModuleCard / Plain mode / Job side effects below.
   */
  function toggleSwitch(sw) {
    if (sw.disabled || sw.getAttribute("aria-disabled") === "true") return;
    var on = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(on));
    var word = sw.querySelector(".tp-switch__state"); if (word) word.textContent = on ? L("switch.on", "On") : L("switch.off", "Off");
    var card = sw.closest(".tp-module-card, .tp-job-row"); if (card) card.setAttribute("data-on", String(on));
    if (sw.hasAttribute("data-plain-mode")) setPlainMode(on);
    if (typeof TP.onSwitch === "function") TP.onSwitch(sw, on);
  }

  /**
   * PlainModeBanner — Plain mode turns every user module off (built-ins stay).
   * REAL: convex modules.setPlainMode({ on }).
   * STATE: html[data-plain]; .tp-plain-banner hidden/shown; user module switches get aria-disabled.
   */
  function setPlainMode(on) {
    root.setAttribute("data-plain", on ? "on" : "off");
    $$(".tp-plain-banner").forEach(function (b) { b.hidden = !on; });
    $$('.tp-module-card:not([data-builtin="true"]) .tp-switch').forEach(function (s) {
      if (on) s.setAttribute("aria-disabled", "true"); else s.removeAttribute("aria-disabled");
    });
    announce(on ? L("plain.on", "Plain mode is on. Your own modules are paused.") : L("plain.off", "Plain mode is off."));
  }

  /* ---------- Flashcard ---------------------------------------- */
  /**
   * Flashcard — flip with a BUTTON (never hover). Prev / Next step through the deck.
   * REAL: none to flip; studyCards.review({ cardId, grade }) later (study track).
   * STATE: .tp-flashcard[data-side="front"|"back"]; flip button aria-pressed + label; counter text.
   */
  function flipCard(btn) {
    var fc = btn.closest(".tp-flashcard"); if (!fc) return;
    var back = fc.getAttribute("data-side") !== "back";
    fc.setAttribute("data-side", back ? "back" : "front");
    btn.setAttribute("aria-pressed", String(back));
    var lbl = btn.querySelector("[data-label]") || btn;
    lbl.textContent = back ? L("card.showQuestion", "Show question") : L("card.showAnswer", "Show answer");
    var face = fc.querySelector('.tp-flashcard__face[data-face="' + (back ? "back" : "front") + '"]');
    if (face) { face.setAttribute("tabindex", "-1"); face.focus({ preventScroll: true }); }
  }
  function stepCard(btn) {
    var fc = btn.closest(".tp-flashcard"); if (!fc || !fc._deck) return;
    var dir = btn.getAttribute("data-dir") === "prev" ? -1 : 1;
    fc._i = (fc._i + dir + fc._deck.length) % fc._deck.length;
    renderCard(fc);
  }
  function renderCard(fc) {
    var c = fc._deck[fc._i];
    var f = fc.querySelector('[data-face="front"] .tp-flashcard__text'), b = fc.querySelector('[data-face="back"] .tp-flashcard__text');
    if (f) f.textContent = c.front; if (b) b.textContent = c.back;
    fc.setAttribute("data-side", "front");
    var flip = fc.querySelector('[data-action="card-flip"]');
    if (flip) { flip.setAttribute("aria-pressed", "false"); var l = flip.querySelector("[data-label]") || flip; l.textContent = L("card.showAnswer", "Show answer"); }
    var n = fc.querySelector("[data-card-n]"); if (n) n.textContent = String(fc._i + 1);
  }
  /** Reads an optional JSON deck from <script type="application/json" data-deck> inside the flashcard (demo data only; never shown). */
  function initDecks() {
    $$(".tp-flashcard").forEach(function (fc) {
      var s = fc.querySelector("script[data-deck]"); if (!s) return;
      try { fc._deck = JSON.parse(s.textContent); fc._i = 0; } catch (e) { fc._deck = null; }
    });
  }

  /* ---------- Quiz ---------------------------------------------- */
  /**
   * Quiz — radio options; "Check" shows feedback as icon + words, never colour alone.
   * REAL: quizzes.answer({ quizId, optionId }) -> { correct } (artifact block state saved in the page).
   * STATE: .tp-quiz[data-checked]; .tp-quiz__feedback[data-result="right"|"wrong"] text + icon; correct option marked.
   */
  function checkQuiz(btn) {
    var q = btn.closest("[data-quiz]") || btn.closest(".tp-artifact") || doc;
    var set = q.querySelector(".tp-quiz"); if (!set) return;
    var picked = set.querySelector("input:checked");
    var fb = q.querySelector(".tp-quiz__feedback");
    if (!picked) { if (fb) { fb.hidden = false; fb.setAttribute("data-result", "wrong"); fb.innerHTML = icon("info", "tp-icon--sm") + "<span>" + L("quiz.pick", "Pick one answer first.") + "</span>"; } return; }
    var right = picked.closest(".tp-choice").getAttribute("data-correct") === "true";
    set.setAttribute("data-checked", "true");
    if (fb) {
      fb.hidden = false;
      fb.setAttribute("data-result", right ? "right" : "wrong");
      var ans = set.querySelector('.tp-choice[data-correct="true"] .tp-choice__label');
      fb.innerHTML = icon(right ? "check" : "info", "tp-icon--sm") + "<span></span>";
      fb.querySelector("span").textContent = right ? L("quiz.right", "Right.") : L("quiz.wrong", "Not quite. The answer is: ") + (right || !ans ? "" : ans.textContent);
      fb.setAttribute("role", "status");
    }
  }

  /* ---------- Checklist + Tracker ------------------------------- */
  /**
   * Checklist — native checkboxes; updates the "2 of 5 done" line.
   * REAL: pages.updateBlock({ blockId, patch: { items } }) (optimistic).
   * STATE: li[data-done]; .tp-checklist__count text.
   */
  function syncChecklist(list) {
    var items = $$(".tp-checklist__item", list), done = 0;
    items.forEach(function (li) { var c = li.querySelector(".tp-checkbox"); var on = !!(c && c.checked); li.setAttribute("data-done", String(on)); if (on) done++; });
    var wrap = list.closest(".tp-artifact") || list.parentNode;
    var count = wrap && wrap.querySelector(".tp-checklist__count");
    if (count) count.textContent = done + " " + L("checklist.of", "of") + " " + items.length + " " + L("checklist.done", "done");
  }
  /**
   * Tracker — small counter with − / + buttons.
   * REAL: trackers.log({ blockId, delta }) (optimistic).
   * STATE: .tp-tracker__value text; aria-live announcement.
   */
  function stepTracker(btn) {
    var t = btn.closest(".tp-tracker"), v = t && t.querySelector(".tp-tracker__value"); if (!v) return;
    var n = Math.max(0, (parseInt(v.textContent, 10) || 0) + (btn.getAttribute("data-dir") === "dec" ? -1 : 1));
    v.textContent = String(n);
    var name = t.querySelector(".tp-tracker__name"); announce((name ? name.textContent + ": " : "") + n);
  }

  /* ---------- Blocks: habit, nag, template, broken -------------- */
  /**
   * HabitBlock — gentle log for today. No streak counter anywhere.
   * REAL: convex habits.log({ habitId, date: localDate }) / habits.unlog (5-min Undo via toast).
   * STATE: .tp-habit[data-logged]; today's .tp-habit-day[data-done]; button label; sr text.
   */
  function logHabit(btn) {
    var h = btn.closest(".tp-habit"); if (!h) return;
    var on = h.getAttribute("data-logged") !== "true";
    h.setAttribute("data-logged", String(on));
    btn.setAttribute("aria-pressed", String(on));
    var lbl = btn.querySelector("[data-label]") || btn;
    lbl.textContent = on ? L("habit.logged", "Logged today") : L("habit.log", "Log today");
    var today = h.querySelector('.tp-habit-day[data-today="true"]');
    if (today) {
      today.setAttribute("data-done", String(on));
      var sr = today.querySelector(".tp-sr-only"); if (sr) sr.textContent = on ? L("habit.dayDone", "logged") : L("habit.dayOpen", "not logged");
    }
  }
  /**
   * NagBlock — the user's own phrase. Do it now / Snooze / Not today. "Not today" is never failure.
   * REAL: convex nags.respond({ nagId, choice: "now"|"snooze"|"nottoday" }) — snooze = +30 min (EXTRAPOLATED).
   * STATE: .tp-nag[data-status]; .tp-nag__note text; focus to the note.
   */
  function answerNag(btn) {
    var n = btn.closest(".tp-nag"); if (!n) return;
    var c = btn.getAttribute("data-choice") || "now";
    var map = { now: ["done", L("nag.now", "Good. It's on now.")], snooze: ["snoozed", L("nag.snooze", "Snoozed for 30 minutes.")], nottoday: ["nottoday", L("nag.nottoday", "Okay. Not today. It'll ask again tomorrow.")] };
    var m = map[c] || map.now;
    n.setAttribute("data-status", m[0]);
    var note = n.querySelector(".tp-nag__note");
    if (note) { note.hidden = false; var t = note.querySelector("[data-note]") || note; t.textContent = m[1]; note.setAttribute("tabindex", "-1"); note.focus({ preventScroll: true }); }
  }
  /**
   * TemplateBlock — "Use the Daily template?" one primary + "Not now".
   * REAL: convex templates.apply({ pageId, templateId }) (5-min Undo) / templates.dismissOffer({ pageId }).
   * STATE: .tp-template-offer[data-status="used"|"dismissed"]; note text; Undo toast on use.
   */
  function answerTemplate(btn, use) {
    var o = btn.closest(".tp-template-offer"); if (!o) return;
    o.setAttribute("data-status", use ? "used" : "dismissed");
    var note = o.querySelector(".tp-template-offer__note");
    if (note) { note.hidden = false; (note.querySelector("[data-note]") || note).textContent = use ? L("template.used", "Template added to this page.") : L("template.dismissed", "Okay. This page stays as it is."); }
    if (use) TP.toast({ title: L("template.used", "Template added to this page."), onUndo: function () { o.setAttribute("data-status", "offered"); if (note) note.hidden = true; } });
  }
  /**
   * BrokenBlock — "This part has a problem." + Undo (restores the last good version of this block).
   * REAL: convex pages.revertBlock({ pageId, blockId }).
   * STATE: the broken card is replaced by a quiet "Restored" line (demo).
   */
  function undoBroken(btn) {
    var b = btn.closest(".tp-block-broken"); if (!b) return;
    b.innerHTML = '<span class="tp-block-broken__text">' + L("broken.restored", "Restored the last version of this part.") + "</span>";
    announce(L("broken.restored", "Restored the last version of this part."));
  }

  /* ---------- Kanban -------------------------------------------- */
  /**
   * KanbanCard move — Move to previous / next column with BUTTONS (drag is never the only way).
   * DOM order = logical order, so in RTL "previous" is visually to the right; icons use .tp-icon--flip.
   * REAL: convex tasks.moveColumn({ id, toColumnId, index }) (optimistic, 5-min Undo).
   * STATE: card moves to the sibling column list; counts update; edge buttons disabled; focus stays on the card's same button.
   */
  function moveCard(btn) {
    var card = btn.closest(".tp-kanban-card"), board = btn.closest(".tp-kanban"); if (!card || !board) return;
    var cols = $$(".tp-kanban__col", board), from = card.closest(".tp-kanban__col");
    var i = cols.indexOf(from) + (btn.getAttribute("data-dir") === "prev" ? -1 : 1);
    if (i < 0 || i >= cols.length) return;
    var list = cols[i].querySelector(".tp-kanban__list"); if (!list) return;
    var li = card.closest("li") || card;
    list.appendChild(li);
    card.setAttribute("data-moved", "true"); setTimeout(function () { card.removeAttribute("data-moved"); }, 260);
    syncKanban(board);
    var again = card.querySelector('[data-action="kanban-move"][data-dir="' + btn.getAttribute("data-dir") + '"]');
    (again && !again.disabled ? again : card.querySelector('[data-action="kanban-move"]:not([disabled])') || card).focus();
    var name = cols[i].querySelector(".tp-kanban__name"), title = card.querySelector(".tp-kanban-card__title");
    announce((title ? title.textContent : "") + " → " + (name ? name.textContent : ""));
  }
  function syncKanban(board) {
    var cols = $$(".tp-kanban__col", board);
    cols.forEach(function (col, ci) {
      var n = col.querySelectorAll(".tp-kanban-card").length;
      var c = col.querySelector(".tp-kanban__count"); if (c) c.textContent = String(n);
      $$(".tp-kanban-card", col).forEach(function (card) {
        var p = card.querySelector('[data-action="kanban-move"][data-dir="prev"]'), x = card.querySelector('[data-action="kanban-move"][data-dir="next"]');
        if (p) p.disabled = ci === 0; if (x) x.disabled = ci === cols.length - 1;
      });
    });
  }

  /* ---------- Sheet (bottom sheet / dialog) ---------------------- */
  /**
   * MobileSheet — open/close with focus management. Esc closes. Focus returns to the opener.
   * REAL: none (UI state). shadcn <Sheet side="bottom"> / vaul <Drawer>.
   * STATE: sheet [hidden] + aria-modal; scrim [hidden]; opener aria-expanded; body scroll lock.
   */
  var sheetOpener = null;
  TP.openSheet = function (id, opener) {
    var s = doc.getElementById(id); if (!s) return;
    sheetOpener = opener || doc.activeElement;
    s.hidden = false; s.setAttribute("role", s.getAttribute("role") || "dialog"); s.setAttribute("aria-modal", "true");
    var scrim = $('.tp-sheet-scrim[data-for="' + id + '"]') || $(".tp-sheet-scrim"); if (scrim) scrim.hidden = false;
    if (opener) opener.setAttribute("aria-expanded", "true");
    doc.body.style.overflow = "hidden";
    var f = s.querySelector("[autofocus], input, textarea, select, button:not(.tp-sheet__close), a[href]") || s.querySelector("button");
    if (f) f.focus();
  };
  TP.closeSheet = function (s) {
    s = s || $(".tp-sheet:not([hidden])"); if (!s) return;
    s.hidden = true;
    $$(".tp-sheet-scrim").forEach(function (sc) { sc.hidden = true; });
    doc.body.style.overflow = "";
    if (sheetOpener) { sheetOpener.setAttribute("aria-expanded", "false"); if (sheetOpener.focus) sheetOpener.focus(); }
    sheetOpener = null;
  };
  function trapSheet(e) {
    var s = $(".tp-sheet:not([hidden])"); if (!s || e.key !== "Tab") return;
    var f = $$('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', s);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Sort menu ----------------------------------------- */
  /**
   * SortMenu — button + menu of menuitemradio. Arrow keys move; Esc closes; focus returns.
   * REAL: none (client sort) or the list query's sort arg, e.g. tasks.list({ sort }).
   * STATE: button aria-expanded; list [hidden]; item aria-checked; button value label.
   */
  function toggleMenu(btn, open) {
    var list = doc.getElementById(btn.getAttribute("aria-controls")); if (!list) return;
    if (open == null) open = list.hidden;
    list.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) { var cur = list.querySelector('[aria-checked="true"]') || list.querySelector('[role^="menuitem"]'); if (cur) cur.focus(); }
  }
  function chooseMenu(item) {
    var list = item.closest('[role="menu"]'); if (!list) return;
    $$('[role="menuitemradio"]', list).forEach(function (i) { i.setAttribute("aria-checked", String(i === item)); });
    var btn = doc.querySelector('[aria-controls="' + list.id + '"]');
    if (btn) { var v = btn.querySelector("[data-menu-value]"); if (v) v.textContent = (item.querySelector("[data-label]") || item).textContent.trim(); toggleMenu(btn, false); btn.focus(); }
    if (typeof TP.onSort === "function") TP.onSort(item.getAttribute("data-value"));
  }
  function menuKeys(e) {
    var item = e.target.closest('[role="menu"] [role^="menuitem"]'); if (!item) return false;
    var items = $$('[role^="menuitem"]', item.closest('[role="menu"]')), i = items.indexOf(item);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus(); return true; }
    if (e.key === "Escape") { var btn = doc.querySelector('[aria-controls="' + item.closest('[role="menu"]').id + '"]'); if (btn) { toggleMenu(btn, false); btn.focus(); } return true; }
    return false;
  }

  /* ---------- Load more ------------------------------------------ */
  /**
   * LoadMore — reveals the next page of rows.
   * REAL: usePaginatedQuery(api.tasks.list, args, { initialNumItems: 20 }).loadMore(20).
   * STATE: rows with [data-more] un-hidden (demo, up to data-step at a time); status text; button disabled at the end.
   */
  function loadMore(btn) {
    var wrap = btn.closest(".tp-load-more"), scope = (wrap && wrap.parentNode) || doc;
    var step = parseInt(btn.getAttribute("data-step"), 10) || 5;
    var hidden = $$("[data-more][hidden]", scope).slice(0, step);
    hidden.forEach(function (el) { el.hidden = false; el.setAttribute("data-new", "true"); });
    var shown = $$("[data-more]:not([hidden])", scope).length + $$("[data-row]:not([data-more])", scope).length;
    var total = parseInt(btn.getAttribute("data-total"), 10) || shown;
    var status = wrap && wrap.querySelector(".tp-load-more__status");
    var left = $$("[data-more][hidden]", scope).length;
    if (status) status.textContent = left ? L("more.showing", "Showing") + " " + shown + " " + L("more.of", "of") + " " + total : L("more.all", "That's everything.");
    if (!left) btn.disabled = true;
    if (hidden[0]) { var f = hidden[0].querySelector("a, button") || hidden[0]; f.setAttribute && f.focus && f.focus({ preventScroll: false }); }
  }

  /* ---------- Week strip / month grid --------------------------- */
  /**
   * WeekStrip / MonthGrid day select.
   * REAL: router.push(`/today?date=${date}`) or pages.getDaily({ date }).
   * STATE: aria-pressed on the chosen day only; TP.onDaySelect(date) hook for the screen.
   */
  function selectDay(btn) {
    var group = btn.closest(".tp-week-strip, .tp-month__grid"); if (!group) return;
    $$('[data-action="select-day"]', group).forEach(function (d) { d.setAttribute("aria-pressed", String(d === btn)); });
    if (typeof TP.onDaySelect === "function") TP.onDaySelect(btn.getAttribute("data-date"), btn);
  }

  /* ---------- Coach: dial, panic/grounding, read aloud --------- */
  /**
   * Dial (0–10) — shows the number AND the word: quiet 0–3 · steady 4–7 · push 8–10.
   * REAL: convex profiles.setCoachDial({ value }) (debounced 400ms).
   * STATE: [data-dial-num] text, [data-dial-word] text, input aria-valuetext.
   */
  function dialWord(v) { return v <= 3 ? L("dial.quiet", "Quiet") : v <= 7 ? L("dial.steady", "Steady") : L("dial.push", "Push"); }
  function syncDial(input) {
    var d = input.closest(".tp-dial"); if (!d) return;
    var v = parseInt(input.value, 10) || 0, w = dialWord(v);
    var n = d.querySelector("[data-dial-num]"), wd = d.querySelector("[data-dial-word]");
    if (n) n.textContent = String(v); if (wd) wd.textContent = w;
    input.setAttribute("aria-valuetext", v + " " + L("dial.of", "of 10") + ", " + w);
  }
  /**
   * PanicButton -> GroundingCard. Shows a breathing line and ONE 10-second action. No model call.
   * REAL: coach.logPanic({}) (analytics only, optional); the card copy is fixed.
   * STATE: grounding card [hidden]=false; .tp-breath[data-phase] cycles in/hold/out every 4 s;
   *        label word changes (meaning is in the word); reduced motion keeps the words, no transition.
   */
  var breathTimer = null;
  function openGrounding(btn) {
    var id = btn.getAttribute("aria-controls"), card = id ? doc.getElementById(id) : $(".tp-grounding"); if (!card) return;
    card.hidden = false; btn.setAttribute("aria-expanded", "true");
    var b = card.querySelector(".tp-breath"), lbl = b && b.querySelector(".tp-breath__label");
    var phases = [["in", L("breath.in", "Breathe in")], ["hold", L("breath.hold", "Hold")], ["out", L("breath.out", "Breathe out")]], i = 0;
    function step() { if (!b) return; b.setAttribute("data-phase", phases[i][0]); if (lbl) lbl.textContent = phases[i][1]; i = (i + 1) % phases.length; }
    clearInterval(breathTimer); step(); breathTimer = setInterval(step, 4000);
    var h = card.querySelector("h2, h3, [tabindex]"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }
  function closeGrounding(btn) {
    var card = btn.closest(".tp-grounding"); if (!card) return;
    clearInterval(breathTimer); breathTimer = null;
    var note = card.querySelector("[data-grounding-done]");
    if (note) { note.hidden = false; note.setAttribute("tabindex", "-1"); note.focus(); } else card.hidden = true;
  }
  /**
   * ReadAloudButton — read one message / transcript line / note aloud.
   * REAL: voice.speak({ text, lang }) via the TTS route; here the browser speechSynthesis stands in.
   * STATE: aria-pressed; label "Read aloud" <-> "Stop reading"; only one reads at a time.
   */
  function readAloud(btn) {
    var on = btn.getAttribute("aria-pressed") !== "true";
    $$('.tp-readaloud[aria-pressed="true"]').forEach(function (b) { setRead(b, false); });
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (!on) return;
    setRead(btn, true);
    var host = btn.closest(".tp-msg, .tp-call-line, [data-readable]");
    var src = btn.getAttribute("data-read") ? doc.getElementById(btn.getAttribute("data-read"))
            : host ? host.querySelector(".tp-msg__text, .tp-call-line__text, [data-read-text]") : null;
    var text = src ? src.textContent : "";
    if (window.speechSynthesis && window.SpeechSynthesisUtterance && text) {
      var u = new SpeechSynthesisUtterance(text); u.lang = root.lang === "he" ? "he-IL" : "en-GB";
      u.onend = function () { setRead(btn, false); }; speechSynthesis.speak(u);
    } else { setTimeout(function () { setRead(btn, false); }, 2400); }
  }
  function setRead(btn, on) {
    btn.setAttribute("aria-pressed", String(on));
    var l = btn.querySelector("[data-label]"); if (l) l.textContent = on ? L("read.stop", "Stop reading") : L("read.aloud", "Read aloud");
    var u = btn.querySelector("use"); if (u) u.setAttribute("href", on ? "#i-pause" : "#i-volume");
  }

  /* ---------- Memory ---------------------------------------------- */
  /**
   * MemoryItem forget — removes one fact, with the shared 5-minute Undo toast.
   * REAL: convex memory.forget({ id }) (soft delete) / memory.restore({ id }) on Undo.
   * STATE: row [hidden]; toast; focus moves to the next row's Forget button (or the list).
   */
  function forgetMemory(btn) {
    var row = btn.closest(".tp-memory-row"); if (!row) return;
    var li = row.closest("li") || row, next = li.nextElementSibling || li.previousElementSibling;
    li.hidden = true;
    var fact = row.querySelector(".tp-memory-row__fact");
    TP.toast({ title: L("memory.forgot", "Forgotten"), onUndo: function () { li.hidden = false; var b = li.querySelector('[data-action="memory-forget"]'); if (b) b.focus(); } });
    var f = next && next.querySelector('[data-action="memory-forget"]'); if (f) f.focus();
    announce(L("memory.forgot", "Forgotten") + (fact ? ": " + fact.textContent : ""));
  }
  /**
   * ImportReview — keep / edit / drop per row (Stage 1 radiogroup handles aria-checked).
   * REAL: memory.importReview({ items: [{ text, choice }] }) on Save; nothing is saved before.
   * STATE: row[data-choice]; text contenteditable on "edit"; note word; "N will be saved" counter.
   */
  function chooseImport(opt) {
    var row = opt.closest(".tp-import-row"); if (!row) return;
    var c = opt.getAttribute("data-value") || "keep";
    row.setAttribute("data-choice", c);
    var t = row.querySelector(".tp-import-row__text");
    if (t) { if (c === "edit") { t.setAttribute("contenteditable", "true"); t.focus(); } else t.removeAttribute("contenteditable"); }
    var note = row.querySelector(".tp-import-row__note");
    if (note) note.textContent = c === "drop" ? L("import.drop", "Will be left out") : c === "edit" ? L("import.edit", "Editing: type your change") : L("import.keep", "Will be saved");
    var list = row.closest(".tp-import-list"), count = doc.querySelector("[data-import-count]");
    if (list && count) count.textContent = String($$('.tp-import-row:not([data-choice="drop"])', list).length);
  }
  /**
   * ExportArea — export all memories as Markdown.
   * REAL: convex memory.exportMarkdown({}) -> file URL (download).
   * STATE: status text "Your file is ready" (demo, no file).
   */
  function exportMemory(btn) {
    var a = btn.closest(".tp-export"), s = a && a.querySelector(".tp-export__note");
    btn.disabled = true;
    if (s) s.textContent = L("export.working", "Making your file…");
    setTimeout(function () { btn.disabled = false; if (s) s.textContent = L("export.ready", "Your file is ready. It downloaded as memories.md."); }, 900);
  }

  /* ---------- Voice call ----------------------------------------- */
  /**
   * VoiceCall — demo state machine for the live call overlay.
   * REAL: voice.startSession({ lang }) opens a realtime audio session (WebRTC/WebSocket);
   *       voiceSessions row opens on start and closes on End (minutes are real audio time).
   * STATE: .tp-call[data-state] = connecting | listening | speaking | paused | (data-ended);
   *        .tp-call__state TEXT label (the meaning); level bars (decorative); mic aria-pressed.
   */
  var call = { el: null, timer: null, opener: null };
  var CALL_LABEL = {
    connecting: function () { return L("call.connecting", "Connecting…"); },
    listening: function () { return L("call.listening", "Listening"); },
    speaking: function () { return L("call.speaking", "Speaking"); },
    paused: function () { return L("call.paused", "Paused"); }
  };
  TP.callSetState = function (state, el) {
    el = el || call.el || $(".tp-call"); if (!el) return;
    call.el = el; el.setAttribute("data-state", state);
    var lbl = el.querySelector(".tp-call__state"); if (lbl) lbl.textContent = CALL_LABEL[state] ? CALL_LABEL[state]() : state;
    var mic = el.querySelector(".tp-call__mic");
    if (mic) {
      var on = state !== "paused";
      mic.setAttribute("aria-pressed", String(on));
      var u = mic.querySelector("use"); if (u) u.setAttribute("href", on ? "#i-mic" : "#i-mic-off");
      var ml = el.querySelector(".tp-call__mic-label"); if (ml) ml.textContent = on ? L("call.micOn", "Mic on") : L("call.micOff", "Mic off");
      mic.setAttribute("aria-label", on ? L("call.mute", "Turn mic off") : L("call.unmute", "Turn mic on"));
    }
    var intr = el.querySelector('[data-action="call-interrupt"]'); if (intr) intr.disabled = state !== "speaking";
    animateLevels(el, state);
  };
  /** AudioLevel — decorative bars; REAL: AnalyserNode RMS per bar. Skipped under reduced motion. */
  function animateLevels(el, state) {
    clearInterval(call.timer);
    var bars = $$(".tp-level__bar", el);
    if (reduceMotion || state === "paused" || state === "connecting") { bars.forEach(function (b) { b.style.removeProperty("--level"); }); return; }
    call.timer = setInterval(function () {
      bars.forEach(function (b, i) { var base = state === "speaking" ? 0.35 : 0.2; b.style.setProperty("--level", (base + Math.random() * (1 - base) * (0.6 + 0.4 * Math.sin(i))).toFixed(2)); });
    }, 140);
  }
  /** Open the call overlay (from the coach composer's voice button). REAL: voice.startSession({ lang }). STATE: overlay shown, focus to mic. */
  TP.openCall = function (id, opener) {
    var el = doc.getElementById(id) || $(".tp-call"); if (!el) return;
    call.opener = opener || doc.activeElement; el.hidden = false; el.removeAttribute("data-ended");
    TP.callSetState("connecting", el);
    setTimeout(function () { TP.callSetState("listening", el); }, 700);
    var mic = el.querySelector(".tp-call__mic"); if (mic) mic.focus();
  };
  /** MicToggle — REAL: track.enabled = !track.enabled (no new session). STATE: listening <-> paused. */
  function toggleMic(btn) { var el = btn.closest(".tp-call"); TP.callSetState(el.getAttribute("data-state") === "paused" ? "listening" : "paused", el); }
  /** Interrupt — REAL: session.interrupt() stops coach audio at once (barge-in). STATE: speaking -> listening; coach line marked "(stopped)". */
  function interrupt(btn) {
    var el = btn.closest(".tp-call");
    var live = el.querySelector('.tp-call-line[data-who="coach"][data-live="true"]');
    if (live) { live.removeAttribute("data-live"); var t = live.querySelector(".tp-call-line__text"); if (t) t.textContent += " " + L("call.stopped", "(you cut in)"); }
    TP.callSetState("listening", el); announce(L("call.interrupted", "Coach stopped. Listening."));
  }
  /** End call — REAL: voice.endSession({ sessionId }) closes the voiceSessions row. STATE: data-ended; label "Call ended"; focus to "Back to chat" or opener. */
  function endCall(btn) {
    var el = btn.closest(".tp-call"); clearInterval(call.timer);
    el.setAttribute("data-ended", "true"); el.setAttribute("data-state", "paused");
    var lbl = el.querySelector(".tp-call__state"); if (lbl) lbl.textContent = L("call.ended", "Call ended");
    var back = el.querySelector('[data-action="call-close"]');
    if (back) { back.hidden = false; back.focus(); } else { el.hidden = true; if (call.opener && call.opener.focus) call.opener.focus(); }
  }
  /** Close the overlay after End. STATE: hidden; focus returns to opener. */
  function closeCall(btn) { var el = btn.closest(".tp-call"); el.hidden = true; if (call.opener && call.opener.focus) call.opener.focus(); }
  /**
   * PushToTalk — hold to talk (pointer or Space/Enter), release to send.
   * REAL: walkie-talkie mode: record while held -> voice.sendClip({ audio }) -> reply audio (every tier).
   * STATE: .tp-ptt[data-pressed]; label; call state listening while held, speaking after release.
   */
  function pttDown(btn) {
    if (btn.getAttribute("data-pressed") === "true") return;
    btn.setAttribute("data-pressed", "true"); btn.setAttribute("aria-pressed", "true");
    var l = btn.querySelector("[data-label]"); if (l) l.textContent = L("ptt.release", "Listening… let go to send");
    var el = btn.closest(".tp-call"); if (el) TP.callSetState("listening", el);
  }
  function pttUp(btn) {
    if (btn.getAttribute("data-pressed") !== "true") return;
    btn.setAttribute("data-pressed", "false"); btn.setAttribute("aria-pressed", "false");
    var l = btn.querySelector("[data-label]"); if (l) l.textContent = L("ptt.hold", "Hold to talk");
    var el = btn.closest(".tp-call"); if (el) TP.callSetState("speaking", el);
  }
  /** CallActionConfirm Undo — REAL: tasks.remove({ id }) for the task the call just added. STATE: row text "Undone", data-undone. */
  function undoCallAction(btn) {
    var row = btn.closest(".tp-call-action"); if (!row) return;
    row.setAttribute("data-undone", "true");
    var t = row.querySelector(".tp-call-action__text"); if (t) t.textContent = L("call.undone", "Undone. Nothing was added.");
    btn.hidden = true; announce(L("call.undone", "Undone. Nothing was added."));
  }
  /** LanguageChip — REAL: voice.setLanguage({ lang }) (also the coach's reply language). STATE: chip label + data-lang; the page language is NOT changed. */
  function toggleCallLang(btn) {
    var he = btn.getAttribute("data-lang") !== "he";
    btn.setAttribute("data-lang", he ? "he" : "en");
    var cur = btn.querySelector("[data-lang-current]"), other = btn.querySelector(".tp-lang-chip__other");
    if (cur) { cur.textContent = he ? "עברית" : "English"; cur.setAttribute("lang", he ? "he" : "en"); }
    if (other) { other.textContent = he ? "English" : "עברית"; other.setAttribute("lang", he ? "en" : "he"); }
    announce(he ? "עברית" : "English");
  }

  /* ---------- Delegated events ------------------------------------ */
  doc.addEventListener("click", function (e) {
    var a = e.target.closest("[data-action]");
    var sw = e.target.closest('.tp-switch[role="switch"]');
    if (sw && (!a || a === sw)) { toggleSwitch(sw); return; }
    var imp = e.target.closest('.tp-import-row [role="radio"]'); if (imp) { chooseImport(imp); }
    var mi = e.target.closest('[role="menu"] [role="menuitemradio"]'); if (mi) { chooseMenu(mi); return; }
    if (!a) {
      $$('.tp-menu__list:not([hidden])').forEach(function (l) { if (!l.parentNode.contains(e.target)) { var b = doc.querySelector('[aria-controls="' + l.id + '"]'); if (b) toggleMenu(b, false); } });
      return;
    }
    var act = a.getAttribute("data-action");
    switch (act) {
      case "undo": { var t = a.closest(".tp-toast"); if (t && typeof t._onUndo === "function") { t._onUndo(); t._onUndo = null; } break; }
      case "card-flip": flipCard(a); break;
      case "card-step": stepCard(a); break;
      case "quiz-check": checkQuiz(a); break;
      case "tracker": stepTracker(a); break;
      case "habit-log": logHabit(a); break;
      case "nag": answerNag(a); break;
      case "template-use": answerTemplate(a, true); break;
      case "template-dismiss": answerTemplate(a, false); break;
      case "broken-undo": undoBroken(a); break;
      case "kanban-move": moveCard(a); break;
      case "open-sheet": TP.openSheet(a.getAttribute("aria-controls") || a.getAttribute("data-target"), a); break;
      case "close-sheet": TP.closeSheet(a.closest(".tp-sheet") || null); break;
      case "menu": toggleMenu(a); break;
      case "load-more": loadMore(a); break;
      case "select-day": selectDay(a); break;
      case "panic": openGrounding(a); break;
      case "grounding-done": closeGrounding(a); break;
      case "read-aloud": readAloud(a); break;
      case "memory-forget": forgetMemory(a); break;
      case "memory-export": exportMemory(a); break;
      case "open-call": TP.openCall(a.getAttribute("aria-controls"), a); break;
      case "call-mic": toggleMic(a); break;
      case "call-interrupt": interrupt(a); break;
      case "call-end": endCall(a); break;
      case "call-close": closeCall(a); break;
      case "call-undo": undoCallAction(a); break;
      case "call-lang": toggleCallLang(a); break;
      case "retry": /** StateError Retry — REAL: refetch the failed query. STATE: back to default (demo). */
        TP.setState("default"); announce(L("state.retried", "Loaded.")); break;
      default: break;
    }
  });

  doc.addEventListener("change", function (e) {
    var cb = e.target.closest(".tp-checklist .tp-checkbox"); if (cb) syncChecklist(cb.closest(".tp-checklist"));
  });
  doc.addEventListener("input", function (e) {
    if (e.target.matches && e.target.matches(".tp-dial .tp-slider")) syncDial(e.target);
  });

  /* Keyboard: capture phase so an open sheet/menu owns Escape before Stage 1 handlers. */
  doc.addEventListener("keydown", function (e) {
    if (menuKeys(e)) { e.stopPropagation(); return; }
    var openSheet = $(".tp-sheet:not([hidden])");
    if (openSheet) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); TP.closeSheet(openSheet); return; }
      trapSheet(e);
    }
    var callEl = $(".tp-call:not([hidden])");
    if (callEl && e.key === "Escape" && !callEl.hasAttribute("data-ended")) {
      /* Esc pauses the mic rather than ending the call (ending needs the End button). */
      e.stopPropagation(); TP.callSetState("paused", callEl); return;
    }
    var ptt = e.target.closest && e.target.closest(".tp-ptt");
    if (ptt && (e.key === " " || e.key === "Enter")) { e.preventDefault(); if (!e.repeat) pttDown(ptt); }
  }, true);
  doc.addEventListener("keyup", function (e) {
    var ptt = e.target.closest && e.target.closest(".tp-ptt");
    if (ptt && (e.key === " " || e.key === "Enter")) { e.preventDefault(); pttUp(ptt); }
  });
  /* Push-to-talk pointer hold (touch + mouse + pen). */
  doc.addEventListener("pointerdown", function (e) { var p = e.target.closest(".tp-ptt"); if (p) { p.setPointerCapture && p.setPointerCapture(e.pointerId); pttDown(p); } });
  ["pointerup", "pointercancel"].forEach(function (t) { doc.addEventListener(t, function (e) { var p = e.target.closest && e.target.closest(".tp-ptt"); if (p) pttUp(p); else $$('.tp-ptt[data-pressed="true"]').forEach(pttUp); }); });

  /* ---------- Boot (Stage 2) -------------------------------------- */
  function boot2() {
    initDecks();
    $$(".tp-kanban").forEach(syncKanban);
    $$(".tp-checklist").forEach(syncChecklist);
    $$(".tp-dial .tp-slider").forEach(syncDial);
    var c = $(".tp-call:not([hidden])"); if (c) TP.callSetState(c.getAttribute("data-state") || "listening", c);
    if (params.get("plain") === "on") setPlainMode(true);
    if (typeof TP.onReady2 === "function") TP.onReady2(params);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot2); else boot2();
})();
