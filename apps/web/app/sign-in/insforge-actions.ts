"use server";

import { clearAuthCookies, createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { DATA_BACKEND, parseDataBackend } from "../../lib/backend-flag";
import { makeInsforgeOtpActions } from "../../lib/insforge/otp";

const UPSTREAM_TIMEOUT_MS = 8_000;

/** Same path, domain and secure flags the OTP actions pass when they set the session cookies. */
const sessionCookieOptions = {
  accessToken: { secure: true },
  refreshToken: { secure: true },
};

const otpActions = makeInsforgeOtpActions(
  {
    backend: DATA_BACKEND,
    url: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
  cookies
);

export async function requestInsforgeOtp(email: unknown) {
  return otpActions.requestCode(email);
}

export async function verifyInsforgeOtp(email: unknown, code: unknown) {
  return otpActions.verifyCode(email, code);
}

/**
 * Clears the InsForge session cookies and returns nothing.
 * The SDK logout is best-effort: a provider error still clears the local cookies.
 */
export async function signOutInsforge(): Promise<void> {
  const store = await cookies();
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY?.trim();
  if (parseDataBackend(process.env.NEXT_PUBLIC_DATA_BACKEND) === "insforge" && baseUrl && anonKey) {
    try {
      await createAuthActions({
        baseUrl,
        anonKey,
        cookies: store,
        retryCount: 0,
        timeout: UPSTREAM_TIMEOUT_MS,
        options: sessionCookieOptions,
      }).signOut();
    } catch {
      // The provider revoke is best-effort. Local cookies still clear.
    }
  }
  clearAuthCookies(store, { options: sessionCookieOptions });
}
