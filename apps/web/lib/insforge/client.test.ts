import { describe, expect, mock, test } from "bun:test";
import { makeInsforgeClientGetter } from "./client";

const baseUrl = "https://insforge.example.invalid";
const anonKey = "test-placeholder";

describe("makeInsforgeClientGetter", () => {
  test.each([
    ["missing URL", undefined, anonKey],
    ["missing key", baseUrl, undefined],
    ["whitespace-only URL", " \t", anonKey],
    ["whitespace-only key", baseUrl, " \n"],
  ] as const)("returns null for %s", (_label, url, key) => {
    const create = mock(() => ({}));
    const getClient = makeInsforgeClientGetter({ url, anonKey: key }, create);

    expect(getClient()).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  test("creates one client lazily with trimmed values", () => {
    const client = {};
    const create = mock(() => client);
    const getClient = makeInsforgeClientGetter(
      {
        url: ` ${baseUrl} `,
        anonKey: ` ${anonKey} `,
      },
      create
    );

    expect(create).not.toHaveBeenCalled();
    expect(getClient()).toBe(client);
    expect(getClient()).toBe(client);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ baseUrl, anonKey });
  });
});
