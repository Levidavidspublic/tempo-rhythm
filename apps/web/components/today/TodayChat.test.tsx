/**
 * Today's chat on a phone in Hebrew (TEMPO-B07-34): coach proposal cards and their buttons stay
 * inside the chat column. bun:test has no layout engine, so this renders the chat with a long
 * Hebrew proposal, turns each `[&_…]:utility` class on the chat into the selector Tailwind builds
 * from it, and checks with Bun's HTMLRewriter that the selector reaches the rows that need it.
 * The browser measurement at 390 px is the conductor's.
 */
import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** A word with no break in it, the kind that pushes a column wider (a pasted link, a long name). */
const LONG_WORD = "תכניתעבודהמפורטתלסוףהשבועהזהבלירווחיםבכלל";
const NOW = Date.now();

const MESSAGES = [
  {
    _id: "messages:1",
    role: "user",
    content: `באיזה סדר כדאי לי לעשות את אלה היום? ${LONG_WORD}`,
  },
  {
    _id: "messages:2",
    role: "assistant",
    content: "הנה סדר פשוט: קודם הדבר הקטן, אחר כך הגדול. שום דבר לא משתנה עד שתאשרו.",
    toolCalls: {
      coachProposal: {
        kind: "decision",
        title: `אחר הצהריים של יום חמישי הארוך ${LONG_WORD}`,
        steps: [
          { title: `לענות לדנה על ההודעה מהבוקר ${LONG_WORD}`, minutes: 10, reason: "זה משחרר אותה להמשיך" },
          { title: "לכתוב את הטיוטה של הדוח הרבעוני", minutes: 45 },
          { title: "הליכה קצרה", minutes: 15 },
        ],
        status: "accepted",
        createdId: "notes:1",
        undoUntilMs: NOW + 4 * 60_000,
      },
    },
  },
  {
    _id: "messages:3",
    role: "assistant",
    content: "אפשר להוסיף את זה כמשימה להיום.",
    toolCalls: {
      coachProposal: {
        kind: "task",
        title: `להתקשר לרופאת השיניים ולקבוע תור לפני החגים ${LONG_WORD}`,
        minutes: 10,
        when: "today",
        status: "accepted",
        createdId: "tasks:1",
        undoUntilMs: NOW + 4 * 60_000,
      },
    },
  },
];

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  // Only the thread has data: the server render never runs the effect that picks a conversation.
  useQuery: (ref: unknown) => (ref === "messages.list" ? MESSAGES : undefined),
  useMutation: () => async () => null,
  useAction: () => async () => ({ status: "idle" }),
  useConvex: () => ({ query: async () => ({ isCrisis: false }) }),
}));

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    conversations: { list: "conversations.list", create: "conversations.create" },
    messages: { list: "messages.list" },
    coach: {
      sendMessage: "coach.sendMessage",
      reply: "coach.reply",
      acceptProposal: "coach.acceptProposal",
      rejectProposal: "coach.rejectProposal",
      undoProposal: "coach.undoProposal",
    },
    crisis: { check: "crisis.check", resourcesCard: "crisis.resourcesCard" },
    voice: {
      availability: "voice.availability",
      start: "voice.start",
      renew: "voice.renew",
      stop: "voice.stop",
      grant: "voice.grant",
      speak: "voice.speak",
    },
  },
}));

const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "he", dir: "rtl", setLang: () => {}, t: (key: Parameters<typeof translate>[1]) => translate("he", key) }),
}));

// OpenUI cards are the default (#994); `?openui=off` still draws the direct cards. Both are checked.
let openUi = true;
mock.module("@/lib/openui/useOpenUiFlag", () => ({ useOpenUiFlag: () => openUi }));

const { TodayChat } = await import("./TodayChat");

function renderChat(withOpenUi: boolean): string {
  openUi = withOpenUi;
  return renderToStaticMarkup(createElement(TodayChat));
}

/** Bun's built-in HTMLRewriter: it matches CSS selectors against the rendered markup. */
// biome-ignore lint/correctness/noUndeclaredVariables: a Bun global (bun-types), unknown to Biome.
const Rewriter = HTMLRewriter;

/** HTMLRewriter hands attributes back as written: undo React's escaping of `&` and `>`. */
function unescapeHtml(value: string): string {
  return value.replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

/** The class list on the chat's own section. */
function chatClasses(html: string): string[] {
  let classes: string[] = [];
  new Rewriter()
    .on('section[data-component="TodayChat"]', {
      element(el) {
        classes = unescapeHtml(el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
      },
    })
    .transform(html);
  return classes;
}

/** The selector Tailwind builds for `[&_X]:utility` on the chat: `&` is the chat, `_` is a space. */
function selectorFor(cls: string): string {
  const variant = /^\[(.+)\]:[\w-]+$/.exec(cls)?.[1];
  if (!variant) throw new Error(`not an arbitrary variant: ${cls}`);
  return variant.replaceAll("&", '[data-component="TodayChat"]').replaceAll("_", " ");
}

type Hit = { className: string; text: string };

/** Every element the selector reaches, with the text inside it (descendants included). */
function hits(html: string, selector: string): Hit[] {
  const found: Hit[] = [];
  new Rewriter()
    .on(selector, {
      element(el) {
        found.push({ className: el.getAttribute("class") ?? "", text: "" });
      },
      text(chunk) {
        const last = found.at(-1);
        if (last) last.text += unescapeHtml(chunk.text);
      },
    })
    .transform(html);
  return found;
}

function count(html: string, selector: string): number {
  return hits(html, selector).length;
}

/** The chat's class that applies `utility` through an `[&_…]` variant. */
function fitClass(classes: string[], utility: string, target: string): string {
  const cls = classes.find((c) => c === `[&_${target}]:${utility}`);
  expect(cls).toBe(`[&_${target}]:${utility}`);
  return cls as string;
}

for (const withOpenUi of [true, false]) {
  describe(`Today's chat in Hebrew, ${withOpenUi ? "OpenUI cards" : "direct cards (?openui=off)"}`, () => {
    const html = renderChat(withOpenUi);
    const classes = chatClasses(html);

    test("the long Hebrew proposal is on screen: two saved cards, each with Open and Undo", () => {
      expect(classes).toContain("tp-today-chat");
      expect(count(html, ".tp-proposal")).toBe(2);
      expect(count(html, '[data-renderer="openui"]')).toBe(withOpenUi ? 2 : 0);
      expect(html).toContain(LONG_WORD);
      expect(count(html, ".tp-proposal__note a.tp-btn")).toBe(2);
      expect(count(html, ".tp-proposal__note button.tp-btn")).toBe(2);
    });

    test("every row of the thread, the card's wrapper included, may be narrower than its content (min-w-0)", () => {
      const rows = hits(html, selectorFor(fitClass(classes, "min-w-0", ".tp-coach-thread>*")));
      // 3 messages + 2 cards: the column is as wide as the thread, whatever a row holds.
      expect(rows.length).toBe(5);
      expect(rows.filter((row) => row.className.includes("tp-msg")).length).toBe(3);
      const cardRows = rows.filter((row) => !row.className.includes("tp-msg"));
      expect(cardRows.length).toBe(2);
      for (const row of cardRows) expect(row.text).toContain(LONG_WORD);
      // With OpenUI the row is the renderer's plain wrapper div, not the card itself: the card's
      // own overflow: hidden does not keep that wrapper's min-content out of the column.
      for (const row of cardRows) expect(row.className === "tp-proposal").toBe(!withOpenUi);
    });

    test("a long word breaks inside the thread instead of pushing the column (wrap-anywhere)", () => {
      const thread = hits(html, selectorFor(fitClass(classes, "wrap-anywhere", ".tp-coach-thread")));
      expect(thread.length).toBe(1);
      expect(thread[0].className).toBe("tp-coach-thread");
      // The message, both card titles and a step all hold the unbroken word.
      expect(thread[0].text.split(LONG_WORD).length - 1).toBe(4);
    });

    test("each card's last row wraps, so Open and Undo go below the words (flex-wrap)", () => {
      const rows = hits(html, selectorFor(fitClass(classes, "flex-wrap", ".tp-proposal>p")));
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(row.className).toBe("tp-proposal__note");
        expect(row.text).toContain(translate("he", "proposal.open"));
        expect(row.text).toContain(translate("he", "proposal.undo"));
      }
    });

    test("the words in that row keep about 12rem and take the free space (grow, basis-48)", () => {
      const grow = hits(html, selectorFor(fitClass(classes, "grow", ".tp-proposal>p>span")));
      const basis = hits(html, selectorFor(fitClass(classes, "basis-48", ".tp-proposal>p>span")));
      expect(grow.map((s) => s.text)).toEqual([
        translate("he", "proposal.decision.saved"),
        translate("he", "proposal.accepted"),
      ]);
      expect(basis.map((s) => s.text)).toEqual(grow.map((s) => s.text));
    });
  });
}
