/**
 * Create ONE disposable mail.tm inbox for a preview acceptance run and write
 * {"address","password"} to --out with file mode 0600. Prints only
 * "inbox created" or a failure status code: never the address or the password.
 *
 *   node scripts/e2e/new-inbox.mjs --out "$RUNNER_TEMP/inbox.json"
 *
 * The inbox is synthetic (tempo-accept-<hex>@<mail.tm domain>). Hand it to
 * scripts/e2e/magic-link-login.mjs through TEMPO_TEST_EMAIL and
 * TEMPO_TEST_INBOX_PASSWORD. Delete the --out file when the run ends.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MAIL_API = "https://api.mail.tm";
const ATTEMPTS = 3;

function arg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function mail(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
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
  return { status: response.status, json };
}

// mail.tm rate-limits bursts (429) and has short outages (5xx): retry those, a few times.
async function mailWithRetry(path, options) {
  let last = { status: 0, json: null };
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    last = await mail(path, options);
    if (last.status !== 429 && last.status < 500) return last;
    if (attempt < ATTEMPTS) await sleep(attempt * 2_000);
  }
  return last;
}

function members(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return payload["hydra:member"] ?? payload.member ?? [];
}

class InboxError extends Error {}

async function main() {
  const outArg = arg("--out");
  if (!outArg) throw new InboxError("missing --out");
  const out = resolve(outArg);
  // Refuse before creating an account, so a bad --out never leaves an orphan inbox behind.
  if (existsSync(out)) throw new InboxError("--out already exists");

  const domains = await mailWithRetry("/domains");
  if (domains.status !== 200) throw new InboxError(`domains status ${domains.status}`);
  const domain = members(domains.json).find(
    (item) => item && typeof item.domain === "string" && item.isActive !== false
  )?.domain;
  if (!domain) throw new InboxError("no active domain");

  const address = `tempo-accept-${randomBytes(6).toString("hex")}@${domain}`;
  const password = randomBytes(18).toString("base64url");
  const created = await mailWithRetry("/accounts", {
    method: "POST",
    body: { address, password },
  });
  if (created.status !== 201 && created.status !== 200) {
    throw new InboxError(`account status ${created.status}`);
  }

  await mkdir(dirname(out), { recursive: true });
  // "wx": never follow or overwrite an existing file; mode applies to the new file.
  await writeFile(out, `${JSON.stringify({ address, password })}\n`, { mode: 0o600, flag: "wx" });
  await chmod(out, 0o600);
  console.log("inbox created");
}

main().catch((error) => {
  // Only our own short reasons or an error class name: never a payload, address or password.
  const code = (value) =>
    value && typeof value === "object" && typeof value.code === "string" ? value.code : null;
  const reason =
    error instanceof InboxError
      ? error.message
      : (code(error) ?? code(error?.cause) ?? (error instanceof Error ? error.name : "unknown"));
  console.error(`inbox failed: ${reason}`);
  process.exit(1);
});
