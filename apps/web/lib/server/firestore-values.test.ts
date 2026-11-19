import { expect, test } from "bun:test";

import {
  decodeFields,
  encodeFields,
  FirestoreValueError,
  type RestFields,
} from "./firestore-values";

const task = {
  title: "Ship codec",
  createdAt: 1_731_000_000_000,
  completed: false,
  note: null,
  checklist: [
    { id: "one", text: "Encode", completed: true },
    { id: "two", text: "Decode", completed: false },
  ],
};

test("encodes scalar values to exact Firestore REST shapes", () => {
  expect(
    encodeFields({ title: "Task", completed: false, note: null, createdAt: 1_731_000_000_000, rank: 0.5 })
  ).toEqual({
    title: { stringValue: "Task" },
    completed: { booleanValue: false },
    note: { nullValue: null },
    createdAt: { integerValue: "1731000000000" },
    rank: { doubleValue: 0.5 },
  });
});

test("encodes a task-like object with checklist maps", () => {
  expect(encodeFields(task).checklist).toEqual({
    arrayValue: {
      values: [
        {
          mapValue: {
            fields: {
              id: { stringValue: "one" },
              text: { stringValue: "Encode" },
              completed: { booleanValue: true },
            },
          },
        },
        {
          mapValue: {
            fields: {
              id: { stringValue: "two" },
              text: { stringValue: "Decode" },
              completed: { booleanValue: false },
            },
          },
        },
      ],
    },
  });
});

test("omits undefined keys at every map level", () => {
  expect(encodeFields({ absent: undefined, nested: { kept: "yes", absent: undefined } })).toEqual({
    nested: { mapValue: { fields: { kept: { stringValue: "yes" } } } },
  });
});

test("rejects unsupported values with their field paths", () => {
  for (const [input, path] of [
    [{ score: Number.NaN }, "score"],
    [{ score: Number.POSITIVE_INFINITY }, "score"],
    [{ checklist: [["nested"]] }, "checklist[0]"],
    [{ metadata: { when: new Date(0) } }, "metadata.when"],
  ] as const) {
    expect(() => encodeFields(input)).toThrow(FirestoreValueError);
    expect(() => encodeFields(input)).toThrow(path);
  }
});

test("round trips a task-like object", () => {
  expect(decodeFields(encodeFields(task))).toEqual(task);
});

test("decodes empty containers and timestamps and rejects invalid REST values", () => {
  expect(
    decodeFields({
      emptyList: { arrayValue: {} },
      emptyMap: { mapValue: {} },
      updatedAt: { timestampValue: "2026-11-19T00:00:00Z" },
    })
  ).toEqual({ emptyList: [], emptyMap: {}, updatedAt: "2026-11-19T00:00:00Z" });

  expect(() => decodeFields({ bad: { bytesValue: "abc" } } as unknown as RestFields)).toThrow(
    /bad/
  );
  expect(() =>
    decodeFields({ badInteger: { integerValue: "9007199254740992" } })
  ).toThrow(/badInteger/);
});
