import { describe, expect, test } from "bun:test";

import { NagDocError, parseNagDoc, softDeleteNagDoc } from "./nag-doc";

const validNag = () => ({
  label: "  Morning focus  ",
  enabled: true,
  phrases: [
    {
      id: "one",
      text: "  Start with one small step.  ",
      source: "user",
      status: "accepted",
    },
    {
      id: "two",
      text: "What matters right now?",
      source: "derived",
      status: "proposed",
    },
  ],
  createdAt: 10,
  updatedAt: 20,
});

describe("nag document", () => {
  test("parses a valid nag with two phrases", () => {
    expect(parseNagDoc(validNag())).toEqual({
      ...validNag(),
      label: "Morning focus",
      phrases: [
        {
          id: "one",
          text: "Start with one small step.",
          source: "user",
          status: "accepted",
        },
        {
          id: "two",
          text: "What matters right now?",
          source: "derived",
          status: "proposed",
        },
      ],
    });
  });

  test("refuses an empty label and a non-boolean enabled", () => {
    expect(() => parseNagDoc({ ...validNag(), label: "   " })).toThrow("Invalid field: label");
    expect(() => parseNagDoc({ ...validNag(), enabled: "yes" })).toThrow("Invalid field: enabled");
  });

  test("refuses bad phrase sources and statuses with their index", () => {
    const source = validNag();
    source.phrases[1] = { ...source.phrases[1], source: "model" };
    expect(() => parseNagDoc(source)).toThrow("Invalid field: phrases[1].source");
    const status = validNag();
    status.phrases[0] = { ...status.phrases[0], status: "pending" };
    expect(() => parseNagDoc(status)).toThrow("Invalid field: phrases[0].status");
  });

  test("refuses duplicate phrase ids and more than 50 phrases", () => {
    const duplicate = validNag();
    duplicate.phrases[1] = { ...duplicate.phrases[1], id: "one" };
    expect(() => parseNagDoc(duplicate)).toThrow("Invalid field: phrases[1].id");
    const tooMany = {
      ...validNag(),
      phrases: Array.from({ length: 51 }, (_, id) => ({
        ...validNag().phrases[0],
        id: String(id),
      })),
    };
    expect(() => parseNagDoc(tooMany)).toThrow("Invalid field: phrases");
  });

  test("accepts no phrases and refuses missing phrase elements", () => {
    expect(parseNagDoc({ ...validNag(), phrases: [] }).phrases).toEqual([]);
    expect(() => parseNagDoc({ ...validNag(), phrases: new Array(1) })).toThrow(
      "Invalid field: phrases[0]"
    );
  });

  test("drops legacy keys and refuses unknown top-level and phrase keys", () => {
    const parsed = parseNagDoc({
      ...validNag(),
      userId: "user",
      _id: "nag",
      _creationTime: 1,
    });
    expect(parsed).not.toHaveProperty("userId");
    expect(() => parseNagDoc({ ...validNag(), surprise: true })).toThrow(NagDocError);
    const extraPhrase = validNag();
    expect(() =>
      parseNagDoc({
        ...extraPhrase,
        phrases: [{ ...extraPhrase.phrases[0], extra: true }],
      })
    ).toThrow("Invalid field: phrases[0].extra");
  });

  test("soft deletes a nag while keeping its phrases", () => {
    const parsed = parseNagDoc(validNag());
    const deleted = softDeleteNagDoc(parsed, 99);
    expect(deleted).toEqual({
      ...parsed,
      phrases: parsed.phrases,
      updatedAt: 99,
      deletedAt: 99,
    });
    expect(deleted.phrases).toEqual(parsed.phrases);
  });
});
