import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const migrations = new URL("../../insforge/migrations/", import.meta.url);
const filename = "20261127190000_tempo-chat-requests.sql";
const sql = readFileSync(new URL(filename, migrations), "utf8");

describe("canonical chat requests and coach proposals migration", () => {
  test("ships only the assigned migration filename", () => {
    expect(
      readdirSync(migrations).filter((file) => file.endsWith("_tempo-chat-requests.sql"))
    ).toEqual([filename]);
  });

  test("defines no delete, private queue, or realtime policy", () => {
    for (const policy of sql.match(/\bcreate\s+policy\b[^;]*/gi) ?? []) {
      expect(policy).toMatch(/\bfor\s+(select|insert|update)\b/i);
      expect(policy).not.toMatch(/\bon\s+(?:"?realtime"?\s*\.|public\.chat_requests\b)/i);
    }
  });

  test("uses owner-first foreign keys for the conversation and all task slots", () => {
    expect(sql.match(/foreign key \([^)]*\) references public\.\w+ \([^)]*\)/gi)).toEqual([
      "foreign key (user_id, conversation_id) references public.conversations (user_id, id)",
      "foreign key (user_id, task_1_id) references public.tasks (user_id, id)",
      "foreign key (user_id, task_2_id) references public.tasks (user_id, id)",
      "foreign key (user_id, task_3_id) references public.tasks (user_id, id)",
      "foreign key (user_id, task_4_id) references public.tasks (user_id, id)",
    ]);
  });
});
