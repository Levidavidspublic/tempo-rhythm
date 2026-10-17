/**
 * "Type answers" (typed recall) is remembered per browser: on only when storage says so, off when
 * storage is missing, blocked or throws, and saving never throws.
 */
import { describe, expect, mock, test } from "bun:test";
import {
  browserStorage,
  readTypedAnswers,
  TYPED_ANSWERS_KEY,
  type TypedAnswersStorage,
  writeTypedAnswers,
} from "../../../apps/web/components/study/useTypedAnswers";

function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: mock((key: string, value: string) => void values.set(key, value)),
    removeItem: mock((key: string) => void values.delete(key)),
  } satisfies TypedAnswersStorage & { values: Map<string, string> };
}

const throwing: TypedAnswersStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("typed answers preference", () => {
  test("off by default, on only when the browser remembered it", () => {
    expect(readTypedAnswers(memory())).toBe(false);
    expect(readTypedAnswers(memory({ [TYPED_ANSWERS_KEY]: "on" }))).toBe(true);
    expect(readTypedAnswers(memory({ [TYPED_ANSWERS_KEY]: "yes" }))).toBe(false);
  });

  test("no storage, or storage that throws, reads as off", () => {
    expect(readTypedAnswers(null)).toBe(false);
    expect(readTypedAnswers(throwing)).toBe(false);
  });

  test("turning it on saves it; turning it off forgets it", () => {
    const store = memory();
    writeTypedAnswers(store, true);
    expect(store.values.get(TYPED_ANSWERS_KEY)).toBe("on");
    writeTypedAnswers(store, false);
    expect(store.values.has(TYPED_ANSWERS_KEY)).toBe(false);
    expect(store.removeItem).toHaveBeenCalledWith(TYPED_ANSWERS_KEY);
  });

  test("saving never throws, even when storage does or is missing", () => {
    expect(() => writeTypedAnswers(throwing, true)).not.toThrow();
    expect(() => writeTypedAnswers(throwing, false)).not.toThrow();
    expect(() => writeTypedAnswers(null, true)).not.toThrow();
  });

  test("reaching localStorage that throws (blocked site data) gives no storage", () => {
    const g = globalThis as { window?: unknown };
    const before = g.window;
    g.window = {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    };
    try {
      expect(browserStorage()).toBeNull();
      expect(readTypedAnswers(browserStorage())).toBe(false);
    } finally {
      if (before === undefined) delete g.window;
      else g.window = before;
    }
  });
});
