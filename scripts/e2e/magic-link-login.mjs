/**
 * Sign in to a Tempo preview via the magic-link email and write a Playwright
 * storage state file. Prints host and pathname only — never the code, the
 * inbox password, or the storage-state contents.
 *
 *   node scripts/e2e/magic-link-login.mjs --base "$PLAYWRIGHT_BASE_URL" --out /tmp/tempo-state.json
 *
 * Inbox: TEMPO_TEST_EMAIL + TEMPO_TEST_INBOX_PASSWORD when both are set
 * (mail.tm). Otherwise a new disposable mail.tm inbox.
 */
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

const MAIL_API = "https://api.mail.tm";
const PREVIEW_ORIGIN = "https://preview.tempoflow.dev";
const INTEGRATION_ORIGIN = "https://tempo-1hhdkf59f-amit-levins-projects.vercel.app";

function arg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function redact(text) {
  return String(text)
    .replace(/code=[^&\s"'<>]+/gi, "code=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]");
}

function log(step, fields) {
  const parts = [`step=${step}`];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(`${key}=${redact(value)}`);
  }
  console.log(parts.join(" "));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mail(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${MAIL_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

function members(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return payload["hydra:member"] ?? payload.member ?? [];
}

async function createDisposableInbox() {
  const domains = await mail("/domains");
  if (domains.status !== 200) {
    throw new Error(`mail.tm domains status ${domains.status}`);
  }
  const domain = members(domains.json)[0]?.domain;
  if (!domain) throw new Error("mail.tm returned no domain");
  const local = `tempo-sweep-${randomBytes(6).toString("hex")}`;
  const address = `${local}@${domain}`;
  const password = randomBytes(18).toString("base64url");
  const created = await mail("/accounts", {
    method: "POST",
    body: { address, password },
  });
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`mail.tm account status ${created.status}`);
  }
  const tokenResponse = await mail("/token", {
    method: "POST",
    body: { address, password },
  });
  const token = tokenResponse.json?.token;
  if (!token) throw new Error(`mail.tm token status ${tokenResponse.status}`);
  return { token, inbox: "disposable", address };
}

async function existingInbox() {
  const address = process.env.TEMPO_TEST_EMAIL;
  const password = process.env.TEMPO_TEST_INBOX_PASSWORD;
  if (!address || !password) return null;
  const tokenResponse = await mail("/token", {
    method: "POST",
    body: { address, password },
  });
  const token = tokenResponse.json?.token;
  if (!token) throw new Error(`mail.tm token status ${tokenResponse.status}`);
  return { token, inbox: "TEMPO_TEST_EMAIL", address };
}

function extractCodeUrl(payload) {
  const raw = JSON.stringify(payload).replace(/\\\//g, "/");
  const match = raw.match(/https?:\/\/[^\s"'\\<>]+code=[^\s"'\\<>&]+/);
  if (!match) return null;
  return match[0].replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
}

function rewriteHost(codeUrl, base) {
  const target = new URL(base);
  const next = new URL(codeUrl);
  next.protocol = target.protocol;
  next.host = target.host;
  return next;
}

async function probeHealth(origin, headers) {
  const response = await fetch(new URL("/api/health", origin), {
    headers,
    redirect: "manual",
  });
  const mitigated = response.headers.get("x-vercel-mitigated");
  let commit = "";
  const type = response.headers.get("content-type") ?? "";
  if (response.status === 200 && type.includes("json")) {
    const body = await response.json();
    commit = typeof body.commit === "string" ? body.commit : "";
  }
  return { status: response.status, mitigated, commit, origin };
}

async function chooseBase() {
  const fromFlag = arg("--base");
  const fromEnv = process.env.PLAYWRIGHT_BASE_URL;
  const explicit = fromFlag || fromEnv;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};
  if (explicit) {
    const health = await probeHealth(explicit, headers);
    log("health", {
      host: new URL(explicit).host,
      status: String(health.status),
      mitigated: health.mitigated ?? "none",
      commit: health.commit || "none",
    });
    return { base: explicit.replace(/\/$/, ""), headers, health };
  }

  const preview = await probeHealth(PREVIEW_ORIGIN, headers);
  log("health", {
    host: new URL(PREVIEW_ORIGIN).host,
    status: String(preview.status),
    mitigated: preview.mitigated ?? "none",
    commit: preview.commit || "none",
  });
  if (preview.status === 200) {
    return { base: PREVIEW_ORIGIN, headers, health: preview };
  }
  if (preview.status === 403 && preview.mitigated === "deny") {
    log("blocked", { host: "preview.tempoflow.dev", status: "403", header: "x-vercel-mitigated: deny" });
  }

  const integration = await probeHealth(INTEGRATION_ORIGIN, headers);
  log("health", {
    host: new URL(INTEGRATION_ORIGIN).host,
    status: String(integration.status),
    mitigated: integration.mitigated ?? "none",
    commit: integration.commit || "none",
  });
  if (integration.status === 200) {
    return { base: INTEGRATION_ORIGIN, headers, health: integration };
  }
  throw new Error(
    `no reachable base (preview status ${preview.status} mitigated ${preview.mitigated ?? "none"}; integration status ${integration.status})`,
  );
}

async function listIds(token) {
  const list = await mail("/messages", { token });
  if (list.status !== 200) throw new Error(`mail.tm messages status ${list.status}`);
  return new Set(members(list.json).map((item) => item.id));
}

async function waitForCodeUrl(token, seen) {
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    await sleep(3_000);
    const list = await mail("/messages", { token });
    if (list.status !== 200) continue;
    const fresh = members(list.json).find((item) => item.id && !seen.has(item.id));
    if (!fresh) continue;
    const full = await mail(`/messages/${fresh.id}`, { token });
    if (full.status !== 200) continue;
    const found = extractCodeUrl(full.json);
    if (found) return found;
  }
  return null;
}

async function main() {
  const out = arg("--out") ?? "/tmp/tempo-e2e-storage.json";
  const { base, headers } = await chooseBase();
  const inbox = (await existingInbox()) ?? (await createDisposableInbox());
  log("inbox", { type: inbox.inbox });

  const seen = await listIds(inbox.token);
  // Playwright's downloaded browser is not in this sandbox. Use the
  // already-installed Chrome binary through Playwright's chromium launcher.
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    extraHTTPHeaders: Object.keys(headers).length > 0 ? headers : undefined,
  });
  const page = await context.newPage();
  try {
    await page.goto(new URL("/sign-in", base).toString(), { waitUntil: "domcontentloaded" });
    await page.locator("#sign-in-email").waitFor({ timeout: 20_000 });
    const address = inbox.address ?? process.env.TEMPO_TEST_EMAIL;
    if (!address) {
      const tokenPayload = await mail("/me", { token: inbox.token });
      inbox.address = tokenPayload.json?.address;
    }
    if (!inbox.address) throw new Error("inbox address missing");
    await page.locator("#sign-in-email").fill(inbox.address);
    await page.getByRole("button", { name: "Send magic link" }).click();
    await page.getByText("Check your email").waitFor({ timeout: 20_000 });
    log("form", { submitted: "magic-link" });

    const codeUrl = await waitForCodeUrl(inbox.token, seen);
    if (!codeUrl) throw new Error("no magic-link message within 120s");
    const opened = rewriteHost(codeUrl, base);
    log("opened", { host: opened.host, pathname: opened.pathname });
    await page.goto(opened.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForURL(
      (url) => url.pathname === "/today" || url.pathname === "/onboarding",
      { timeout: 30_000 },
    );
    const landed = new URL(page.url());
    if (landed.pathname !== "/today" && landed.pathname !== "/onboarding") {
      throw new Error(`landed on ${landed.pathname}`);
    }
    const stillSignedOut = await page.locator("#sign-in-email").count();
    if (stillSignedOut > 0) throw new Error("sign-in form still visible");
    await mkdir(dirname(out), { recursive: true });
    await context.storageState({ path: out });
    log("saved", { host: landed.host, pathname: landed.pathname, out: "storage-state" });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`step=failed reason=${redact(error instanceof Error ? error.message : "unknown")}`);
  process.exit(1);
});
