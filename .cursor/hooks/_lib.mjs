// Shared helpers for Tempo Flow Cursor hooks.
// All hooks read JSON from stdin, write JSON to stdout, and run with Node.
// Keep zero dependencies so Cursor Cloud agents + local Windows both work.

import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj ?? {}));
}

export function projectRoot() {
  return process.env.CURSOR_PROJECT_DIR || process.cwd();
}

export function currentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot(),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export function findInProgressTicket() {
  try {
    const ticketsDir = `${projectRoot()}/docs/brain/tickets`;
    const files = readdirSync(ticketsDir).filter(
      (f) => f.startsWith("T-") && f.endsWith(".md"),
    );
    for (const f of files) {
      const text = readFileSync(`${ticketsDir}/${f}`, "utf8");
      if (/^\*\*Status:\*\*\s*in-progress/im.test(text)) {
        return f.replace(/\.md$/, "");
      }
    }
  } catch {
    // Submodule not initialized or not present — fine.
  }
  return null;
}

export function isForbiddenShell(command) {
  const c = command.toLowerCase();

  // Block force-pushes to main/master.
  if (/git\s+push\s+.*(--force|-f\b)/.test(c) && /\b(main|master)\b/.test(c)) {
    return "Never force-push to main or master. If you really need it, do it manually from a terminal — not through the agent.";
  }
  // Block destructive resets against origin/main|master.
  if (/git\s+reset\s+--hard\s+origin\/(main|master)/.test(c)) {
    return "Never hard-reset to origin/main|master from inside the agent. If that's really the intent, run it in a terminal.";
  }
  // Block direct convex prod deploy unless env flag is explicit.
  if (/\bconvex\s+deploy\b/.test(c) && !/--prod-confirm\b/.test(c)) {
    return "Use `npx convex dev` locally and the Convex GitHub Action for prod. `convex deploy` is forbidden without `--prod-confirm` sentinel per HARD_RULES.";
  }
  // Block installs of forbidden tech.
  const forbiddenPkgs = [
    "firebase",
    "firebase-admin",
    "@supabase/",
    "prisma",
    "@prisma/",
    "drizzle-orm",
    "mongoose",
    "typeorm",
    "@clerk/",
    "next-auth",
    "@auth0/",
    "better-auth",
    "redux",
    "zustand",
    "jotai",
    "recoil",
    "mobx",
    "axios",
    "openai",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "@google/genai",
  ];
  const installRx =
    /\b(bun\s+(add|install|i)|npm\s+(install|i|add)|pnpm\s+(add|install|i)|yarn\s+add)\b/;
  if (installRx.test(c)) {
    for (const pkg of forbiddenPkgs) {
      if (c.includes(pkg)) {
        return `HARD_RULES §2 forbids installing \`${pkg}\`. See docs/HARD_RULES.md §2 and pick the allowed alternative (Convex / OpenRouter / fetch / Convex reactive queries).`;
      }
    }
  }
  return null;
}

export function isForbiddenWritePath(filePath) {
  if (!filePath) return null;
  const p = filePath.replace(/\\/g, "/");

  // Secrets / env files.
  if (/(^|\/)\.env(?!\.example$)/.test(p)) {
    return `HARD_RULES §13 forbids writing to \`.env*\` files (except \`.env.example\`). Update \`.env.example\` with a placeholder and set the real value in Vercel/EAS env config.`;
  }
  if (/(^|\/)secrets\//.test(p)) {
    return "Never write to `secrets/`. Use Vercel/EAS env vars.";
  }
  // Build artifacts.
  if (/(^|\/)(node_modules|\.next|dist|build|\.turbo|\.expo)(\/|$)/.test(p)) {
    return `Refusing write to build artifact path \`${filePath}\`. Edit source, not outputs.`;
  }
  // Convex generated code.
  if (/(^|\/)convex\/_generated\//.test(p)) {
    return "Do not edit `convex/_generated/*` by hand. Run `npx convex dev` to regenerate.";
  }
  return null;
}
