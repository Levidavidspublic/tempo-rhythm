import { describe, expect, mock, test } from "bun:test";
import { createAuthActions } from "@insforge/sdk/ssr";
import { makeInsforgeOtpActions } from "./otp";

const INSFORGE_CONFIG = {
  backend: "insforge",
  url: " https://insforge.example.invalid ",
  anonKey: " fixture ",
} as const;
const INVALID_EMAILS = [
  null,
  {},
  "",
  "no-domain",
  "a b@example.com",
  `${"a".repeat(254)}@example.com`,
];
const INVALID_CODES = [123456, null, "12345", "1234567", "123a56", "123 456"];
const REJECTED_STATUSES = [401, 404];

function fixture(respond: () => Response) {
  const fetchOtp = Object.assign(
    mock<(...args: Parameters<typeof fetch>) => Promise<Response>>(async () => respond()),
    { preconnect: mock() }
  );
  const setCookie = mock(() => {});
  const getCookies = mock(async () => ({ get: () => undefined, set: setCookie }));
  const actions = makeInsforgeOtpActions(INSFORGE_CONFIG, getCookies, (options) =>
    createAuthActions({ ...options, fetch: fetchOtp })
  );
  return { actions, fetchOtp, getCookies, setCookie };
}

describe("InsForge OTP actions", () => {
  test.each(INVALID_EMAILS)("rejects malformed email without touching auth (%#)", async (email) => {
    const { actions, fetchOtp, getCookies } = fixture(() => Response.json({}));

    expect(await actions.requestCode(email)).toEqual({ status: "invalid-email" });
    expect(await actions.verifyCode(email, "012345")).toEqual({ status: "invalid-email" });
    expect(getCookies).not.toHaveBeenCalled();
    expect(fetchOtp).not.toHaveBeenCalled();
  });

  test.each(INVALID_CODES)("rejects anything other than a six-digit code (%#)", async (code) => {
    const { actions, fetchOtp, getCookies } = fixture(() => Response.json({}));

    expect(await actions.verifyCode("a@example.com", code)).toEqual({ status: "invalid-code" });
    expect(getCookies).not.toHaveBeenCalled();
    expect(fetchOtp).not.toHaveBeenCalled();
  });

  test.each([
    { ...INSFORGE_CONFIG, backend: "convex" },
    { ...INSFORGE_CONFIG, backend: "firebase" },
    { ...INSFORGE_CONFIG, url: undefined },
    { ...INSFORGE_CONFIG, anonKey: " " },
  ] as const)("returns unavailable before touching cookies or SDK (%#)", async (config) => {
    const getCookies = mock(async () => {
      throw new Error("No request cookie store");
    });
    const create = mock(createAuthActions);
    const actions = makeInsforgeOtpActions(config, getCookies, create);

    expect(await actions.requestCode("a@example.com")).toEqual({ status: "unavailable" });
    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "unavailable" });
    expect(getCookies).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("returns unavailable when the request has no writable cookie store", async () => {
    const actions = makeInsforgeOtpActions(INSFORGE_CONFIG, async () => ({ get: () => undefined }));

    expect(await actions.requestCode("a@example.com")).toEqual({ status: "unavailable" });
    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "unavailable" });
  });

  test("sends normalized email in the POST body and supports explicit resend", async () => {
    const { actions, fetchOtp, setCookie } = fixture(() =>
      Response.json({ success: true, message: "Provider message" })
    );

    expect(await actions.requestCode("  A@Example.COM ")).toEqual({ status: "requested" });
    expect(await actions.requestCode("a@example.com")).toEqual({ status: "requested" });
    expect(fetchOtp).toHaveBeenCalledTimes(2);
    for (const [url, request] of fetchOtp.mock.calls) {
      expect(url).toBe("https://insforge.example.invalid/api/auth/email/send-otp");
      expect(request?.method).toBe("POST");
      expect(request?.body).toBe(JSON.stringify({ email: "a@example.com" }));
    }
    expect(setCookie).not.toHaveBeenCalled();
  });

  test.each([404, 429])("keeps account-dependent send results generic (%i)", async (status) => {
    const { actions, fetchOtp, setCookie } = fixture(() =>
      Response.json({ message: "Provider-specific detail" }, { status })
    );

    expect(await actions.requestCode("a@example.com")).toEqual({ status: "requested" });
    expect(fetchOtp).toHaveBeenCalledTimes(1);
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("returns unavailable without disclosing send transport failures", async () => {
    const { actions, fetchOtp } = fixture(() => {
      throw new Error("Fixture transport failed");
    });

    expect(await actions.requestCode("a@example.com")).toEqual({ status: "unavailable" });
    expect(fetchOtp).toHaveBeenCalledTimes(1);
  });

  test.each([500, 503])("returns unavailable for send provider outages (%i)", async (status) => {
    const { actions, fetchOtp, setCookie } = fixture(() =>
      Response.json({ message: "Provider-specific detail" }, { status })
    );

    expect(await actions.requestCode("a@example.com")).toEqual({ status: "unavailable" });
    expect(fetchOtp).toHaveBeenCalledTimes(1);
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("verifies the normalized inputs with the SDK and only returns safe status", async () => {
    const { actions, fetchOtp, setCookie } = fixture(() =>
      Response.json({
        user: { id: "fixture-user", email: "a@example.com" },
        accessToken: "fixture-access",
        refreshToken: "fixture-refresh",
        csrfToken: "fixture-csrf",
      })
    );

    expect(await actions.verifyCode("  A@Example.COM ", " 012345 ")).toEqual({
      status: "verified",
    });
    expect(fetchOtp).toHaveBeenCalledTimes(1);
    expect(fetchOtp).toHaveBeenCalledWith(
      "https://insforge.example.invalid/api/auth/sessions?client_type=mobile",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@example.com", otp: "012345", method: "otp" }),
      })
    );
    expect(setCookie).toHaveBeenCalledTimes(2);
    expect(setCookie).toHaveBeenCalledWith(
      "insforge_access_token",
      "fixture-access",
      expect.objectContaining({ secure: true, sameSite: "lax", path: "/" })
    );
    expect(setCookie).toHaveBeenCalledWith(
      "insforge_refresh_token",
      "fixture-refresh",
      expect.objectContaining({ secure: true, httpOnly: true, sameSite: "lax", path: "/" })
    );
  });

  test.each(REJECTED_STATUSES)("hides verification errors (%i)", async (status) => {
    const { actions, setCookie } = fixture(() => Response.json({ message: "Error" }, { status }));

    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "invalid-code" });
    expect(setCookie).not.toHaveBeenCalled();
  });

  test.each([429, 500, 503])("returns unavailable for failed verification (%i)", async (status) => {
    const { actions, setCookie } = fixture(() =>
      Response.json({ message: "Provider-specific detail" }, { status })
    );

    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "unavailable" });
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("returns unavailable without disclosing verification transport failures", async () => {
    const { actions, setCookie } = fixture(() => {
      throw new Error("Fixture transport failed");
    });

    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "unavailable" });
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("does not report a verified session for an empty provider response", async () => {
    const { actions, setCookie } = fixture(() => Response.json({}));

    expect(await actions.verifyCode("a@example.com", "012345")).toEqual({ status: "invalid-code" });
    expect(setCookie).not.toHaveBeenCalled();
  });
});
