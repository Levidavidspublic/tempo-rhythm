// Jev judge (config ticket, 2026-11-01).
//
// Two per-PR gates in one script, run with `bun .github/scripts/jev-judge.ts <mode>`:
//   judge          — call TypeSafe Jev (typesafe/jev-router) over OpenRouter's System One API to
//                    score a factory PR against its ticket, Amit's style rules (AGENTS.md,
//                    include.md) and the Google TypeScript style guide, then post the scores.
//   process-check  — fail unless the agent's REPORT comment lists the ticket's DONE command and
//                    every STEP.
//
// Request format (OpenRouter TypeSafe System One):
//   https://openrouter.ai/docs/guides/community/typesafe-sdk.md
//   POST https://openrouter.ai/api/v1/systemone
//   { "model": "typesafe/jev-router", "state": "...", "questions": { id: { type: "noul", instructions } } }
//   -> { "answers": { id: { type: "noul", noul: 0..1 } } }
//
// The API key is read from OPENROUTER_API_KEY and is never logged.

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SYSTEM_ONE_URL = "https://openrouter.ai/api/v1/systemone";
export const MODEL = "typesafe/jev-router";
export const PASS_THRESHOLD = 0.85;
export const MASSIVE_VIOLATION_MAX = 0.5;
export const MISSING_KEY_MESSAGE =
  "OPENROUTER_API_KEY not set: Amit adds it in repo Settings > Secrets > Actions";

export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  prompt_cost?: number;
  completion_cost?: number;
  total_cost?: number;
}

// Log the cost OpenRouter reports on a response's `usage` object. Pricing is dynamic
// (OpenRouter sets it per request), so read whatever cost field is present and never
// hard-code a price or a per-token rate.
export function usageCostLine(usage: UsageInfo | undefined): string {
  if (!usage) return "OpenRouter usage: not returned";
  const total = usage.total_cost ?? usage.cost;
  if (typeof total === "number") {
    return `OpenRouter usage cost: $${total.toFixed(6)} (reported by OpenRouter)`;
  }
  if (typeof usage.prompt_cost === "number" && typeof usage.completion_cost === "number") {
    const sum = usage.prompt_cost + usage.completion_cost;
    return `OpenRouter usage cost: $${sum.toFixed(6)} (prompt + completion, reported by OpenRouter)`;
  }
  const tokens = [
    `prompt_tokens=${usage.prompt_tokens ?? "UNKNOWN"}`,
    `completion_tokens=${usage.completion_tokens ?? "UNKNOWN"}`,
    `total_tokens=${usage.total_tokens ?? "UNKNOWN"}`,
  ].join(" ");
  return `OpenRouter usage: ${tokens} (no cost field returned)`;
}

export interface NoulAnswer {
  type?: string;
  noul?: number;
}

export interface Scores {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

export interface Evaluation {
  pass: boolean;
  problems: string[];
}

export interface JudgeInput {
  issueBody: string;
  agentsMd: string;
  includeMd: string;
  diff: string;
  report: string;
}

export interface QuestionSet {
  [key: string]: { type: "noul"; instructions: string };
}

export interface TicketFields {
  steps: string[];
  done: string;
}

export const GOOGLE_STYLE_SUMMARY =
  "Google TypeScript style guide (https://google.github.io/styleguide/tsguide.html). " +
  "Naming: lowerCamelCase for variables, functions, methods, properties and parameters; " +
  "UpperCamelCase (PascalCase) for classes, interfaces, types, enums and type parameters; " +
  "CONSTANT_CASE for module-level constants. Formatting: 2-space indentation, required " +
  "semicolons, single quotes. Clean, readable code with no dead code.";

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "before",
  "being",
  "both",
  "each",
  "for",
  "from",
  "have",
  "into",
  "its",
  "more",
  "not",
  "only",
  "other",
  "our",
  "out",
  "over",
  "same",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "you",
  "your",
]);

// Build the five probability questions (a-e). Each answer is a `noul` (probability 0..1).
export function buildQuestions(): QuestionSet {
  return {
    a: {
      type: "noul",
      instructions:
        "Probability the agent read all the instructions, performed every STEP in the ticket, skipped none, and did nothing outside the ticket's SCOPE and MUTATES.",
    },
    b: {
      type: "noul",
      instructions:
        "Probability the changed code's formatting follows the style guides (Google TypeScript style and the repo's formatter).",
    },
    c: {
      type: "noul",
      instructions: "Probability the changed code's naming follows the style guides.",
    },
    d: {
      type: "noul",
      instructions:
        "Probability the changed code is clean and maintainable (no obvious bugs, duplication, dead code, or poor structure).",
    },
    e: {
      type: "noul",
      instructions:
        "Probability the PR contains a massive violation (forbidden technology, a leaked secret, a change outside scope, skipped required steps, or a serious defect).",
    },
  };
}

export function buildState(input: JudgeInput): string {
  const parts = [
    "=== TICKET (the issue this PR closes) ===",
    input.issueBody || "(no ticket body)",
    "",
    "=== STYLE RULES: AGENTS.md ===",
    input.agentsMd,
    "",
    "=== STYLE RULES: include.md ===",
    input.includeMd,
    "",
    "=== STYLE RULES: Google TypeScript style guide ===",
    GOOGLE_STYLE_SUMMARY,
    "",
    "=== PR DIFF ===",
    input.diff || "(no diff)",
    "",
    "=== AGENT'S REPORT COMMENT ===",
    input.report,
  ];
  return parts.join("\n");
}

export function parseScores(answers: Record<string, NoulAnswer>): Scores {
  const get = (id: string): number => {
    const value = answers[id]?.noul;
    return typeof value === "number" ? value : Number.NaN;
  };
  return { a: get("a"), b: get("b"), c: get("c"), d: get("d"), e: get("e") };
}

export function evaluate(scores: Scores): Evaluation {
  const problems: string[] = [];
  const gates: Array<[string, number]> = [
    ["a (instruction-following)", scores.a],
    ["b (formatting)", scores.b],
    ["c (naming)", scores.c],
    ["d (clean code)", scores.d],
  ];
  for (const [label, value] of gates) {
    if (!Number.isFinite(value)) problems.push(`${label}: no score returned`);
    else if (value < PASS_THRESHOLD)
      problems.push(`${label}: ${value.toFixed(2)} < ${PASS_THRESHOLD}`);
  }
  if (!Number.isFinite(scores.e)) problems.push("e (massive violation): no score returned");
  else if (scores.e >= MASSIVE_VIOLATION_MAX)
    problems.push(`e (massive violation): ${scores.e.toFixed(2)} >= ${MASSIVE_VIOLATION_MAX}`);
  return { pass: problems.length === 0, problems };
}

export function formatComment(scores: Scores, result: Evaluation): string {
  const lines = [
    "## Jev judge (typesafe/jev-router)",
    "",
    "| Question | Probability | Verdict |",
    "| --- | --- | --- |",
    `| a — instruction-following | ${fmt(scores.a)} | ${mark(scores.a >= PASS_THRESHOLD)} |`,
    `| b — formatting | ${fmt(scores.b)} | ${mark(scores.b >= PASS_THRESHOLD)} |`,
    `| c — naming | ${fmt(scores.c)} | ${mark(scores.c >= PASS_THRESHOLD)} |`,
    `| d — clean code | ${fmt(scores.d)} | ${mark(scores.d >= PASS_THRESHOLD)} |`,
    `| e — massive violation | ${fmt(scores.e)} | ${mark(scores.e < MASSIVE_VIOLATION_MAX)} |`,
    "",
    `Pass rule: a–d ≥ ${PASS_THRESHOLD} and e < ${MASSIVE_VIOLATION_MAX}.`,
    "",
    result.pass ? "**Result: PASS**" : `**Result: FAIL** — ${result.problems.join("; ")}`,
  ];
  return lines.join("\n");
}

// Parse the ticket front-matter (`--- ... ---` block, or a bare KEY: value body) into STEPS + DONE.
export function parseTicketFields(body: string): TicketFields {
  const text = (body ?? "").replace(/^\uFEFF/, "");
  const fm = text.match(/^\s*(?:<!--[\s\S]*?-->\s*)*---\s*\n([\s\S]*?)\n---\s*(\n|$)/);
  const section = fm ? fm[1] : text;
  const entries = new Map<string, string>();
  let currentKey: string | null = null;
  const currentValue: string[] = [];
  const keyRe = /^([A-Za-z_][\w-]*):\s*(.*)$/;
  for (const line of section.split("\n")) {
    const m = line.match(keyRe);
    if (m) {
      if (currentKey) entries.set(currentKey, currentValue.join("\n").trim());
      currentKey = m[1].toUpperCase();
      currentValue.length = 0;
      if (m[2]) currentValue.push(m[2]);
    } else if (currentKey) {
      currentValue.push(line);
    }
  }
  if (currentKey) entries.set(currentKey, currentValue.join("\n").trim());
  return {
    steps: splitSteps(entries.get("STEPS") ?? ""),
    done: entries.get("DONE") ?? "",
  };
}

export function splitSteps(raw: string): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 1) return [text];
  const items = lines
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""))
    .filter(Boolean);
  return items.length ? items : [text];
}

export function linkedTicketNumber(body: string): number | null {
  const m = (body ?? "").match(/(?:closes|fixes|resolves)\s+#(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

function significantWords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export interface ReportCheckResult {
  problems: string[];
}

export function checkReportCoverage(ticket: TicketFields, report: string): ReportCheckResult {
  const problems: string[] = [];
  const reportText = (report ?? "").toLowerCase();
  const done = (ticket.done ?? "").trim();
  if (!done) {
    problems.push("ticket has no DONE field; cannot verify DONE coverage");
  } else if (!reportText.includes(done.toLowerCase())) {
    problems.push(`REPORT comment does not list the ticket's DONE command: ${done}`);
  }
  for (const step of ticket.steps) {
    const words = significantWords(step);
    if (words.length === 0) continue;
    if (!words.some((w) => reportText.includes(w))) {
      problems.push(`REPORT comment does not list a STEP: ${step}`);
    }
  }
  return { problems };
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "UNKNOWN";
}

function mark(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

// Run `gh` and return stdout. Throws on a non-zero exit.
function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function readOr(path: string, fallback: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

function findReportComment(prNumber: string): string | null {
  let comments: Array<{ body: string }>;
  try {
    comments = JSON.parse(sh(`gh pr view ${prNumber} --json comments --jq '.comments'`)) as Array<{
      body: string;
    }>;
  } catch {
    return null;
  }
  const reports = comments.filter(
    (c) => /status:\s*(done|stuck|blocked)/i.test(c.body) && /ticket:/i.test(c.body)
  );
  return reports.length ? reports[reports.length - 1].body : null;
}

function postComment(prNumber: string, body: string): void {
  const dir = mkdtempSync(join(tmpdir(), "jev-"));
  const file = join(dir, "comment.md");
  writeFileSync(file, body, "utf8");
  try {
    sh(`gh pr comment ${prNumber} --body-file ${file}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function buildHeaders(apiKey: string): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
}

async function callJev(state: string): Promise<Record<string, NoulAnswer>> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) throw new Error(MISSING_KEY_MESSAGE);
  const res = await fetch(SYSTEM_ONE_URL, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ model: MODEL, state, questions: buildQuestions() }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`System One API returned ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    answers?: Record<string, NoulAnswer>;
    usage?: UsageInfo;
  };
  if (!data.answers) throw new Error("System One API response had no `answers` field");
  console.log(usageCostLine(data.usage));
  return data.answers;
}

async function runJudge(prNumber: string, ticketNumber: number): Promise<void> {
  const issueBody = sh(`gh issue view ${ticketNumber} --json body --jq .body`);
  const state = buildState({
    issueBody,
    agentsMd: readOr("AGENTS.md", "(AGENTS.md not found)"),
    includeMd: readOr("include.md", "(include.md not present in this repository)"),
    diff: sh(`gh pr diff ${prNumber}`),
    report: findReportComment(prNumber) ?? "(no REPORT comment found)",
  });
  const answers = await callJev(state);
  const scores = parseScores(answers);
  const result = evaluate(scores);
  const comment = formatComment(scores, result);
  postComment(prNumber, comment);
  console.log(comment);
  if (!result.pass) process.exit(1);
}

async function runProcessCheck(prNumber: string, ticketNumber: number): Promise<void> {
  const issueBody = sh(`gh issue view ${ticketNumber} --json body --jq .body`);
  const ticket = parseTicketFields(issueBody);
  const report = findReportComment(prNumber);
  if (!report) {
    console.error(
      "No REPORT comment found on the PR (expected a comment with `status:` and `ticket:`)."
    );
    process.exit(1);
  }
  const result = checkReportCoverage(ticket, report);
  if (result.problems.length) {
    console.error("Process check failed:");
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Process check passed: REPORT comment covers ${ticket.steps.length} STEP(s) and the DONE command.`
  );
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "judge";
  const prNumber = process.env.PR_NUMBER ?? "";
  if (!prNumber) {
    console.error("PR_NUMBER is not set; running outside a pull request context.");
    process.exit(2);
  }
  const prBody = sh(`gh pr view ${prNumber} --json body --jq .body`);
  const ticketNumber = linkedTicketNumber(prBody);
  if (!ticketNumber) {
    console.log("No ticket linked (no 'Closes #N' in the PR body); not a ticket PR, skipping.");
    return;
  }
  if (mode === "process-check") await runProcessCheck(prNumber, ticketNumber);
  else await runJudge(prNumber, ticketNumber);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
