/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * crisis path: a match renders CrisisResourcesCard and does not send coaching.
 */
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useQuery: () => undefined,
  useMutation: () => async () => null,
  useAction: () => async () => ({ status: "idle" }),
  useConvex: () => ({
    query: async () => ({ isCrisis: false }),
  }),
}));

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    conversations: { list: "conversations.list", create: "conversations.create" },
    messages: { list: "messages.list" },
    coach: {
      sendMessage: "coach.sendMessage",
      reply: "coach.reply",
      researchCapabilities: "coach.researchCapabilities",
      beginReply: "coach.beginReply",
      replyWithControls: "coach.replyWithControls",
      cancelReply: "coach.cancelReply",
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

// The v3 coach reads its copy through LocaleProvider; render it with the English strings.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang: () => {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));

const { CoachChat, CoachCrisisReply, deliverCoachMessage } = await import("./CoachChat");
const { ChatProposal } = await import("./ChatProposal");

function markup(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("deliverCoachMessage", () => {
  test("a crisis match renders CrisisResourcesCard and does not send coaching", async () => {
    const send = mock(async () => undefined);
    const outcome = await deliverCoachMessage(
      "I want to die",
      async () => ({ isCrisis: true }),
      send,
    );

    expect(outcome).toBe("resources");
    expect(send).not.toHaveBeenCalled();

    const html = markup(createElement(CoachCrisisReply));
    expect(html).toContain('data-testid="coach-crisis-resources"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Help is available");
    expect(html).toContain("Tempo is a coach, not a therapist or counselor.");
    expect(html).not.toContain("{");
  });

  test("a normal message is sent and the chat still exposes Coach and Message", async () => {
    const send = mock(async () => undefined);
    const outcome = await deliverCoachMessage(
      "Help me pick one thing for this afternoon",
      async () => ({ isCrisis: false }),
      send,
    );

    expect(outcome).toBe("sent");
    expect(send).toHaveBeenCalledWith("Help me pick one thing for this afternoon");

    const html = markup(createElement(CoachChat));
    expect(html).toContain("Coach");
    expect(html).toContain("Message");
    expect(html).not.toContain("coach-crisis-resources");
  });
});

describe("ChatProposal", () => {
  test("a pending proposal offers Accept, Edit and Not now, and shows the whole body before Accept", () => {
    const body = "# Trip\n\n- [ ] Passport\n- [ ] Charger\n\nThe last line is far below the first.";
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:1" as never,
        proposal: { kind: "note", title: "Trip", body, status: "pending" },
      }),
    );
    expect(html).toContain(">Accept<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Not now<");
    expect(html).toContain("Show all of it");
    expect(html).toContain("The last line is far below the first.");
  });

  test("an accepted proposal no longer offers Edit", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:2" as never,
        proposal: { kind: "task", title: "Call", minutes: 5, when: "today", status: "accepted", createdId: "tasks:1" },
      }),
    );
    expect(html).not.toContain(">Edit<");
  });

  const STEPS = [
    { title: "Reply to Dana", minutes: 10, reason: "It unblocks her" },
    { title: "Draft the report", minutes: 45 },
  ];

  test("a decision draws its steps as a DecisionCard with Save to today and Not now, and no Accept or Edit", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:3" as never,
        proposal: { kind: "decision", title: "This afternoon", steps: STEPS, status: "pending" } as never,
      }),
    );
    expect(html).toContain('data-component="DecisionCard"');
    expect(html).toContain("This afternoon");
    expect(html).toContain("Suggested order");
    expect(html.indexOf("Reply to Dana")).toBeGreaterThan(-1);
    expect(html.indexOf("Draft the report")).toBeGreaterThan(html.indexOf("Reply to Dana"));
    expect(html).toContain("It unblocks her");
    expect(html).toContain("Save to today");
    expect(html).toContain(">Not now<");
    expect(html).not.toContain(">Accept<");
    expect(html).not.toContain(">Edit<");
  });

  test("a saved decision says so, links to the page that got the steps and offers Undo while it lasts; untitled ones get a default title", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:4" as never,
        proposal: { kind: "decision", steps: STEPS, status: "accepted", createdId: "notes:1", undoUntilMs: Date.now() + 4 * 60_000 } as never,
      }),
    );
    expect(html).toContain("An order for today");
    expect(html).toContain("Saved to today. You can undo this for 5 minutes.");
    expect(html).toContain('href="/notes/notes:1"');
    expect(html).toContain(">Undo<");
    expect(html).not.toContain("Save to today<");
  });
});

const { CoachResearchControls, createResearchReply } = await import("./CoachResearchControls");
type Prepared = Awaited<ReturnType<Parameters<typeof createResearchReply>[0]["begin"]>>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function researchFixture(begin?: () => Promise<Prepared>) {
  const key: import("./CoachResearchControls").ResearchKey = { conversationId: "fixture-conversation" as never, requestId: "11111111-1111-4111-8111-111111111111", replyTo: "fixture-message" as never };
  const prepare = mock(begin ?? (async () => ({ status: "ready" as const, ...key })));
  const reply = mock(async (_key: typeof key) => ({ status: "replied" as const }));
  const cancel = mock(async (_key: typeof key) => ({ status: "cancelled" as const }));
  const turn = createResearchReply({ ...key, begin: prepare, reply, cancel });
  return { key, prepare, reply, cancel, turn };
}

describe("controlled coach reply", () => {
  test("one request identity is prepared and executed only once", async () => {
    const f = researchFixture();
    const first = f.turn.run();
    expect(f.turn.run()).toBe(first);
    expect(await first).toEqual({ status: "replied" });
    expect(await f.turn.run()).toEqual({ status: "replied" });
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.reply).toHaveBeenCalledTimes(1);
    expect(f.reply).toHaveBeenCalledWith(f.key);
  });
  test("cancel before preparation prevents both preparation and the action", async () => {
    const f = researchFixture();
    await f.turn.stop();
    expect(await f.turn.run()).toEqual({ status: "cancelled" });
    expect(f.prepare).not.toHaveBeenCalled();
    expect(f.reply).not.toHaveBeenCalled();
    expect(f.cancel).not.toHaveBeenCalled();
  });
  test("cancel during preparation waits for the reply key then cancels before the action", async () => {
    const ready = deferred<Prepared>();
    const f = researchFixture(() => ready.promise);
    const result = f.turn.run();
    await f.turn.stop();
    expect(f.cancel).not.toHaveBeenCalled();
    ready.resolve({ status: "ready", ...f.key });
    expect(await result).toEqual({ status: "cancelled" });
    expect(f.cancel).toHaveBeenCalledWith(f.key);
    expect(f.reply).not.toHaveBeenCalled();
  });
  test("cancelling an active action keeps the same key and discards its late result", async () => {
    const f = researchFixture();
    const result = deferred<{ status: "replied" }>();
    f.reply.mockImplementation(() => result.promise);
    const running = f.turn.run();
    await Promise.resolve();
    await f.turn.stop();
    result.resolve({ status: "replied" });
    expect(await running).toEqual({ status: "cancelled" });
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect(f.cancel).toHaveBeenCalledWith(f.key);
    expect(f.reply).toHaveBeenCalledTimes(1);
  });
  test("simultaneous cancel attempts share one server request", async () => {
    const f = researchFixture();
    await f.turn.run();
    const stopped = deferred<{ status: "cancelled" }>();
    f.cancel.mockImplementation(() => stopped.promise);
    const one = f.turn.stop();
    const two = f.turn.stop();
    expect(f.cancel).toHaveBeenCalledTimes(1);
    stopped.resolve({ status: "cancelled" });
    await Promise.all([one, two]);
    await f.turn.stop();
    expect(f.cancel).toHaveBeenCalledTimes(1);
  });
  test("a failed cancel can retry the same key without preparing or replying again", async () => {
    const ready = deferred<Prepared>();
    const f = researchFixture(() => ready.promise);
    f.cancel.mockRejectedValueOnce(new Error("Fictional unavailable transport"));
    const running = f.turn.run();
    await f.turn.stop();
    ready.resolve({ status: "ready", ...f.key });
    await expect(running).rejects.toThrow("Fictional unavailable transport");
    await f.turn.stop();
    expect(f.cancel).toHaveBeenCalledTimes(2);
    expect(f.cancel.mock.calls.map(([key]) => key)).toEqual([f.key, f.key]);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.reply).not.toHaveBeenCalled();
  });
  for (const prepared of [{ status: "busy" }, { status: "idle" }, { status: "unsupported", control: "web" }, { status: "unsupported", control: "thinkHard" }] as const) {
    test(`a ${prepared.status}${"control" in prepared ? ` ${prepared.control}` : ""} preparation never runs the action`, async () => {
      const f = researchFixture(async () => prepared);
      expect(await f.turn.run()).toEqual(prepared);
      expect(f.reply).not.toHaveBeenCalled();
    });
  }
  test("an unexpected preparation identity is rejected before the action", async () => {
    const f = researchFixture(async () => ({ status: "ready", requestId: "different", replyTo: "fixture-message" as never }));
    await expect(f.turn.run()).rejects.toThrow("Reply identity did not match");
    expect(f.reply).not.toHaveBeenCalled();
  });
  test("failed preparation cannot silently prepare a second request on retry", async () => {
    const f = researchFixture(async () => { throw new Error("Fictional preparation error"); });
    await expect(f.turn.run()).rejects.toThrow("Fictional preparation error");
    await expect(f.turn.run()).rejects.toThrow("Fictional preparation error");
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.reply).not.toHaveBeenCalled();
  });
});

describe("CoachResearchControls", () => {
  const props = { id: "fixture", value: { useWeb: false, thinkHard: false }, capabilities: { useWeb: true, thinkHard: true }, disabled: false, active: false, stopping: false, onChange: () => {}, onCancel: () => {} };
  test("research controls are mounted in the composer with native buttons and token touch targets", () => {
    const html = markup(createElement(CoachResearchControls, props));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Reply options"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html.match(/min-height:var\(--tp-touch\)/g)).toHaveLength(2);
    expect(html).not.toContain("disabled");
    expect(markup(createElement(CoachChat))).toContain('data-component="CoachResearchControls"');
  });
  test("missing deployment capability leaves both options unavailable without claiming they work", () => {
    const html = markup(createElement(CoachResearchControls, { ...props, capabilities: undefined }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Checking reply options");
    expect(html).toContain('aria-describedby="fixture-research-status"');
  });
  test("capability off leaves a previously selected option reachable so it can be turned off", () => {
    const html = markup(createElement(CoachResearchControls, { ...props, value: { useWeb: true, thinkHard: false }, capabilities: { useWeb: false, thinkHard: false } }));
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("aren&#x27;t available here yet");
  });
  test("active cancellation remains a separate button while choices are busy", () => {
    const html = markup(createElement(CoachResearchControls, { ...props, active: true, disabled: true }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain(">Cancel reply</button>");
    expect(markup(createElement(CoachResearchControls, { ...props, active: true, stopping: true }))).toContain(">Stopping…</button>");
  });
});

// The real mounted composer runs in Chromium with fictional Convex boundaries. The builder is
// a fresh process, so these fixtures cannot inherit Bun's process-wide SSR mocks above.
describe.serial("mounted research composer", () => {
  const root = resolve(import.meta.dir, "../../../..");
  const web = join(root, "apps/web");
  const evidence = join(root, "docs/polish/evidence/kb-research-composer");
  let directory: string;
  let server: ReturnType<typeof Bun.serve>;
  let browser: Browser;
  let page: Page | undefined;
  let errors: string[] = [];
  beforeAll(async () => {
    directory = await mkdtemp(join(web, ".research-composer-fixture-"));
    const entry = join(directory, "entry.tsx");
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {CoachConversation} from "../components/coach/CoachChat";
import {CoachPageProvider,useRegisterCoachPageFlush} from "../components/coach/CoachPage";
const params=new URLSearchParams(location.search),lang=params.get("lang")==="he"?"he":"en";
document.documentElement.lang=lang;document.documentElement.dir=lang==="he"?"rtl":"ltr";document.documentElement.dataset.theme="light";
const conversations=["a","b"].map(id=>({_id:id,title:"Example "+id,chatMode:"legacy",createdAt:1,updatedAt:1}));
const d=window.researchFixture={revision:0,profile:{_id:"fixture-person"},conversations,messages:{a:[],b:[]},capabilities:{useWeb:true,thinkHard:true},voiceAvailable:false,calls:[],pending:[],modes:{sendMessage:"resolve",beginReply:"resolve",replyWithControls:"defer",cancelReply:"resolve",flush:"resolve"},pageId:null};
d.signal=()=>{d.revision++;window.dispatchEvent(new Event("fixture-change"))};
d.perform=(kind,args={})=>{d.calls.push({kind,args:structuredClone(args)});const apply=()=>{const list=d.messages[args.conversationId];if(kind==="sendMessage"){list.push({_id:"message-"+d.calls.length,role:"user",content:args.content,createdAt:Date.now()});d.signal();return {crisis:false}}if(kind==="beginReply"){const m=list.at(-1);m.toolCalls={coachResearch:{requestId:args.requestId,state:"prepared"}};d.signal();return {status:"ready",requestId:args.requestId,replyTo:m._id}}if(kind==="cancelReply"){const m=list.find(m=>m._id===args.replyTo);if(m)m.toolCalls={coachResearch:{requestId:args.requestId,state:"cancelled"}};d.signal();return {status:"cancelled"}}if(kind==="replyWithControls")return {status:"replied"};if(kind==="flush")return;throw new Error("Unexpected fixture call "+kind)};if(d.modes[kind]==="reject")return Promise.reject(new Error("Fictional boundary unavailable"));if(d.modes[kind]==="defer")return new Promise((resolve,reject)=>d.pending.push({kind,resolve:()=>resolve(apply()),reject:()=>reject(new Error("Fictional boundary unavailable"))}));return Promise.resolve(apply())};
d.settle=(kind,success=true)=>{const index=d.pending.findIndex(p=>p.kind===kind);if(index<0)throw new Error("No pending "+kind);const item=d.pending.splice(index,1)[0];success?item.resolve():item.reject()};
function Flush(){useRegisterCoachPageFlush(()=>d.perform("flush"));return null}
function App(){const[id,setId]=React.useState("a");const[pageId,setPageId]=React.useState(null);d.show=setId;d.page=setPageId;return <CoachPageProvider><main><h1>{lang==="he"?"שיחה לדוגמה":"Example chat"}</h1><Flush/><CoachConversation variant="page" pageId={pageId} selection={{id,onChange:setId,removed:new Set()}}/></main></CoachPageProvider>}
createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
`);
    const stubs = {
      "convex/react": `import React from "react";const callbacks=new Map();const d=()=>window.researchFixture;export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export function useQuery(ref,args){React.useSyncExternalStore(fn=>{window.addEventListener("fixture-change",fn);return()=>window.removeEventListener("fixture-change",fn)},()=>d().revision,()=>0);if(args==="skip")return undefined;const key=String(ref);if(key.endsWith("users.getProfile"))return d().profile;if(key.endsWith("conversations.list"))return d().conversations;if(key.endsWith("messages.list"))return d().messages[args.conversationId];if(key.endsWith("researchCapabilities"))return d().capabilities;if(key.endsWith("voice.availability"))return {available:d().voiceAvailable};if(key.endsWith("webSearchStatus"))return {available:false,enabled:false,usedToday:0,dailyLimit:0};return undefined}export function useMutation(ref){const key=String(ref).split(".").at(-1);if(!callbacks.has(key))callbacks.set(key,args=>d().perform(key,args));return callbacks.get(key)}export const useAction=useMutation;const client={query:async()=>({isCrisis:false})};export const useConvex=()=>client;`,
      "next/navigation": `export const useRouter=()=>({push(){},replace(){},refresh(){}});export const usePathname=()=>"/coach";export const useSearchParams=()=>new URLSearchParams();`,
      "next/link": `import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
      "@/components/providers/LocaleProvider": `import {translate} from "${web}/lib/i18n.ts";export function useLocale(){const lang=document.documentElement.lang==="he"?"he":"en";return {lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key),setLang(){}}}`,
      "@/convex/_generated/api": `const node=(path="api")=>new Proxy({},{get(_,key){if(key===Symbol.toPrimitive)return()=>path;if(key==="toString")return()=>path;return node(path+"."+String(key))}});export const api=node();`,
    };
    const builder = join(directory, "build.ts");
    await writeFile(builder, `
import {readFileSync,existsSync,statSync,writeFileSync} from "node:fs";import {join,resolve,basename} from "node:path";
const stubs=${JSON.stringify(stubs)},web=${JSON.stringify(web)},root=${JSON.stringify(root)},dir=${JSON.stringify(directory)};
const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:dir,target:"browser",plugins:[{name:"fictional-composer-boundaries",setup(build){
build.onResolve({filter:/^(@\\/|convex\\/react$|next\\/(navigation|link)$)/},args=>{if(args.path in stubs)return {path:args.path,namespace:"fixture"};if(args.path.startsWith("@/")){const base=resolve(web,args.path.slice(2));const found=[base,base+".ts",base+".tsx",base+".js",join(base,"index.ts"),join(base,"index.tsx")].find(p=>existsSync(p)&&statSync(p).isFile());if(!found)throw new Error("Unresolved fixture import "+args.path);return {path:found}}});
build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:stubs[args.path],loader:"tsx",resolveDir:web}));
}}]});if(!result.success)throw new Error(result.logs.map(String).join("\\n"));for(const output of result.outputs)writeFileSync(join(dir,basename(output.path)),new Uint8Array(await output.arrayBuffer()));
const postcss=(await import(join(web,"node_modules/postcss/lib/postcss.mjs"))).default,tailwind=(await import(join(web,"node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
const path=join(web,"app/globals.css");writeFileSync(join(dir,"globals.css"),(await postcss([tailwind({base:root})]).process(readFileSync(path,"utf8"),{from:path})).css);
`);
    await promisify(execFile)(process.execPath, ["--no-env-file", builder], {
      cwd: web, timeout: 90_000, killSignal: "SIGKILL", maxBuffer: 2 * 1024 * 1024,
      env: { PATH: process.env.PATH, NODE_ENV: "test" },
    });
    const assets = new Map<string, Buffer>();
    for (const name of ["entry.js", "entry.css", "globals.css"]) if (existsSync(join(directory, name))) assets.set(`/${name}`, await readFile(join(directory, name)));
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const url = new URL(request.url);
      const asset = assets.get(url.pathname);
      if (asset) return new Response(new Uint8Array(asset).buffer, { headers: { "Content-Type": url.pathname.endsWith(".css") ? "text/css" : "text/javascript" } });
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${assets.has("/entry.css") ? '<link rel="stylesheet" href="/entry.css">' : ""}<style>body{margin:0;background:var(--tp-ground);color:var(--tp-ink)}main{margin:var(--tp-space-4);max-width:var(--tp-measure)}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script type="module" src="/entry.js"></script></body></html>`, { headers: { "Content-Type": "text/html" } });
    } });
    const executablePath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
    if (!executablePath) throw new Error("A real Chromium is required for mounted composer tests");
    browser = await chromium.launch({ executablePath, args: ["--no-sandbox"], timeout: 30_000 });
  }, 120_000);
  afterEach(async () => {
    try { expect(errors).toEqual([]); }
    finally { await page?.close(); page = undefined; }
  });
  afterAll(async () => {
    const results = await Promise.allSettled([browser?.close(), server?.stop(true), directory ? rm(directory, { recursive: true, force: true }) : undefined]);
    const failures = results.filter(result => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Composer fixture cleanup failed");
  }, 15_000);
  async function open(lang = "en", width = 390) {
    errors = [];
    page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${server.url}?lang=${lang}`);
    await browserExpect(page.locator("textarea")).toBeEnabled();
    await browserExpect(page.getByRole("button", { name: lang === "he" ? "חיפוש ברשת" : "Use the web", exact: true })).toBeEnabled();
    return page;
  }
  async function mode(p: Page, kind: string, value: "resolve" | "reject" | "defer") { await p.evaluate(({kind,value}) => { window.researchFixture.modes[kind] = value; }, {kind,value}); }
  async function calls(p: Page, kind: string, count: number) { await browserExpect.poll(() => p.evaluate(kind => window.researchFixture.calls.filter(call => call.kind === kind).length, kind)).toBe(count); }
  async function settle(p: Page, kind: string, success = true) { await p.evaluate(({kind,success}) => window.researchFixture.settle(kind,success), {kind,success}); }
  async function send(p: Page, text = "Help me plan a short walk") { await p.locator("textarea").fill(text); await p.locator("form").getByRole("button", { name: "Send", exact: true }).click(); }

  test("typed controls are attached once, and cancellation targets that saved message", async () => {
    const p = await open();
    await p.getByRole("button", { name: "Use the web", exact: true }).click();
    await p.getByRole("button", { name: "Think hard", exact: true }).click();
    await send(p);
    await calls(p,"replyWithControls",1);
    await p.getByRole("button", { name: "Cancel reply", exact: true }).click();
    await calls(p,"cancelReply",1);
    const requests = await p.evaluate(() => window.researchFixture.calls.filter(call => ["sendMessage","beginReply","replyWithControls","cancelReply"].includes(call.kind)));
    expect(requests.map(call => call.kind)).toEqual(["sendMessage","beginReply","replyWithControls","cancelReply"]);
    expect(requests[1].args.research).toEqual({useWeb:true,thinkHard:true});
    expect(requests[2].args).toEqual(requests[3].args);
    expect(requests[2].args.requestId).toBe(requests[1].args.requestId);
    await browserExpect(p.locator("textarea")).toBeEnabled();
    await p.locator("textarea").fill("A new draft");
    await settle(p,"replyWithControls");
    await browserExpect(p.locator("textarea")).toHaveValue("A new draft");
    await calls(p,"sendMessage",1);
  });
  test("Cancel during preparation prevents the action and repeated Send never duplicates the message", async () => {
    const p = await open();
    await mode(p,"beginReply","defer");
    await send(p);
    await calls(p,"beginReply",1);
    await p.locator("form").evaluate(form => form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    await p.getByRole("button", { name: "Cancel reply", exact: true }).click();
    await browserExpect(p.getByRole("button", { name: "Stopping…", exact: true })).toBeDisabled();
    await settle(p,"beginReply");
    await calls(p,"cancelReply",1);
    await calls(p,"replyWithControls",0);
    await calls(p,"sendMessage",1);
    await browserExpect(p.locator("textarea")).toBeEnabled();
  });
  test("a rejected cancellation remains retryable with the same key", async () => {
    const p = await open();
    await send(p);
    await calls(p,"replyWithControls",1);
    await mode(p,"cancelReply","reject");
    await p.getByRole("button",{name:"Cancel reply",exact:true}).click();
    await browserExpect(p.getByRole("alert")).toContainText("Couldn't stop the reply yet");
    await mode(p,"cancelReply","resolve");
    await p.getByRole("button",{name:"Cancel reply",exact:true}).click();
    await calls(p,"cancelReply",2);
    const keys=await p.evaluate(()=>window.researchFixture.calls.filter(call=>call.kind==="cancelReply").map(call=>call.args));
    expect(keys[0]).toEqual(keys[1]);
    await settle(p,"replyWithControls");
    await calls(p,"beginReply",1);
  });
  test("late preparation in another chat cannot clear or disable the current draft", async () => {
    const p = await open();
    await mode(p,"beginReply","defer");
    await send(p);
    await calls(p,"beginReply",1);
    await p.evaluate(()=>window.researchFixture.show("b"));
    await browserExpect(p.locator("textarea")).toBeEnabled();
    await p.locator("textarea").fill("Draft in the other chat");
    await settle(p,"beginReply");
    await calls(p,"cancelReply",1);
    await calls(p,"replyWithControls",0);
    await browserExpect(p.locator("textarea")).toHaveValue("Draft in the other chat");
    await browserExpect(p.locator("textarea")).toBeEnabled();
  });
  test("an account change fences an old rejected send and retains the new account draft", async () => {
    const p = await open();
    await mode(p,"sendMessage","defer");
    await send(p,"Draft for the first account");
    await calls(p,"sendMessage",1);
    await p.evaluate(()=>{window.researchFixture.profile={_id:"fixture-second-person"};window.researchFixture.signal()});
    await browserExpect(p.locator("textarea")).toBeEnabled();
    await p.locator("textarea").fill("Draft for the second account");
    await settle(p,"sendMessage",false);
    await browserExpect(p.locator("textarea")).toHaveValue("Draft for the second account");
    await calls(p,"beginReply",0);
    await browserExpect(p.getByRole("alert")).toHaveCount(0);
  });
  test("failed page flush keeps the saved message and retries its reply without sending again", async () => {
    const p = await open();
    await p.evaluate(()=>window.researchFixture.page("fixture-page"));
    await mode(p,"flush","reject");
    await send(p);
    await calls(p,"flush",1);
    await calls(p,"beginReply",0);
    await browserExpect(p.locator('[data-component="CoachUnavailable"]')).toContainText("page");
    await mode(p,"flush","resolve");
    await p.getByRole("button",{name:"Try again",exact:true}).click();
    await calls(p,"beginReply",1);
    await calls(p,"sendMessage",1);
    expect(await p.evaluate(()=>window.researchFixture.calls.find(call=>call.kind==="beginReply")?.args.noteId)).toBe("fixture-page");
  });
  test("a dropped action response cancels the known request before freeing the composer", async () => {
    const p = await open();
    await send(p);
    await calls(p,"replyWithControls",1);
    await settle(p,"replyWithControls",false);
    await calls(p,"cancelReply",1);
    await browserExpect(p.locator("textarea")).toBeEnabled();
    await calls(p,"sendMessage",1);
    await calls(p,"beginReply",1);
  });
  test("starters and follow-ups use the selected controls", async () => {
    const p = await open();
    await p.getByRole("button",{name:"Use the web",exact:true}).click();
    await p.locator('[data-component="CoachStarters"] button').first().click();
    await calls(p,"replyWithControls",1);
    await p.getByRole("button",{name:"Cancel reply",exact:true}).click();
    await settle(p,"replyWithControls");
    await p.evaluate(()=>{window.researchFixture.messages.a.push({_id:"fixture-answer",role:"assistant",content:"Start with a short walk.",createdAt:Date.now()});window.researchFixture.signal()});
    await p.locator('[data-component="CoachFollowUps"] button').first().click();
    await calls(p,"beginReply",2);
    expect(await p.evaluate(()=>window.researchFixture.calls.filter(call=>call.kind==="beginReply").map(call=>call.args.research))).toEqual([{useWeb:true,thinkHard:false},{useWeb:true,thinkHard:false}]);
  });
  test("capability off is honest and a failed send preserves the typed draft", async () => {
    const p = await open();
    await p.evaluate(()=>{window.researchFixture.capabilities={useWeb:false,thinkHard:false};window.researchFixture.voiceAvailable=true;window.researchFixture.signal()});
    await browserExpect(p.getByRole("button",{name:"Use the web",exact:true})).toBeDisabled();
    await browserExpect(p.getByRole("button",{name:"Think hard",exact:true})).toBeDisabled();
    await browserExpect(p.locator('[data-component="VoiceStart"]')).toBeVisible();
    await mode(p,"sendMessage","reject");
    await send(p,"Keep this draft");
    await browserExpect(p.getByRole("alert")).toBeVisible();
    await browserExpect(p.locator("textarea")).toHaveValue("Keep this draft");
    await calls(p,"beginReply",0);
  });
  for (const lang of ["en","he"]) for (const width of [390,1280]) {
    test(`${lang} at ${width}: token touch targets, keyboard controls and no horizontal scroll`, async () => {
      const p=await open(lang,width);
      const controls=p.locator('[data-component="CoachResearchControls"]');
      const button=controls.getByRole("button").first();
      await button.focus();
      await p.keyboard.press("Space");
      await browserExpect(button).toHaveAttribute("aria-pressed","true");
      await browserExpect(button).toBeFocused();
      const targets=await controls.getByRole("button").evaluateAll(buttons=>buttons.map(button=>{const rect=button.getBoundingClientRect();return {width:rect.width,height:rect.height}}));
      for(const target of targets){expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44)}
      expect(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      expect(await p.locator("html").getAttribute("dir")).toBe(lang==="he"?"rtl":"ltr");
      expect(await p.locator("main").count()).toBe(1);
      expect(await p.locator("h1").count()).toBe(1);
      await mkdir(evidence,{recursive:true});
      await p.screenshot({path:join(evidence,`composer-${lang}-${width}-light.png`),fullPage:true});
    });
  }
});

type ResearchFixture = {
  profile: { _id: string };
  capabilities: { useWeb: boolean; thinkHard: boolean };
  voiceAvailable: boolean;
  modes: Record<string, "resolve" | "reject" | "defer">;
  calls: { kind: string; args: Record<string, unknown> }[];
  messages: Record<string, { _id: string; role: string; content: string; createdAt: number }[]>;
  show(id: string): void;
  page(id: string): void;
  signal(): void;
  settle(kind: string, success?: boolean): void;
};
declare global { interface Window { researchFixture: ResearchFixture; } }
