import { describe, expect, test } from "bun:test";
import { readBodyLimited } from "./read-body";

/** A POST request with the given body and headers. */
const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://example.com/x", { method: "POST", body, headers });

describe("byte-limited body reader", () => {
  test("returns the text when it fits, exactly as sent", async () => {
    expect(await readBodyLimited(post('{"email":"dana@example.com"}'), 2048)).toBe(
      '{"email":"dana@example.com"}'
    );
    expect(
      await readBodyLimited(new Request("https://example.com/x", { method: "POST" }), 10)
    ).toBe("");
  });

  test("counts bytes, not characters", async () => {
    const text = "\u05e9\u05dc\u05d5\u05dd"; // 4 Hebrew letters, 8 bytes in UTF-8
    expect(await readBodyLimited(post(text), 8)).toBe(text);
    expect(await readBodyLimited(post(text), 7)).toBeNull();
  });

  test("refuses on the declared length without reading", async () => {
    const request = post("small", { "content-length": "999999" });
    expect(await readBodyLimited(request, 100)).toBeNull();
    expect(request.bodyUsed).toBe(false);
  });

  test("stops a stream that runs past the limit", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    const request = new Request("https://example.com/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readBodyLimited(request, 4096)).toBeNull();
    expect(pulled).toBeLessThan(20);
  });

  test("a body that breaks off mid-read is unreadable, not a crash", async () => {
    let sent = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(new Uint8Array(8));
          return;
        }
        controller.error(new Error("connection reset"));
      },
    });
    const request = new Request("https://example.com/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readBodyLimited(request, 4096)).toBeNull();
  });
});
