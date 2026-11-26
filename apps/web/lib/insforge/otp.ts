import { type CookieStore, createAuthActions } from "@insforge/sdk/ssr";
import type { DataBackend } from "../backend-flag";
import { normalizeSignInEmail } from "../email-link-sign-in";

type OtpConfig = {
  backend: DataBackend;
  url?: string;
  anonKey?: string;
};

export function makeInsforgeOtpActions(
  config: OtpConfig,
  getCookies: () => Promise<CookieStore>,
  create = createAuthActions
) {
  const baseUrl = config.url?.trim();
  const anonKey = config.anonKey?.trim();

  async function getAuth() {
    if (config.backend !== "insforge" || !baseUrl || !anonKey) return null;

    try {
      return create({
        baseUrl,
        anonKey,
        cookies: await getCookies(),
        retryCount: 0,
        options: {
          accessToken: { secure: true },
          refreshToken: { secure: true },
        },
      });
    } catch {
      return null;
    }
  }

  return {
    async requestCode(rawEmail: unknown) {
      const email = typeof rawEmail === "string" ? normalizeSignInEmail(rawEmail) : null;
      if (!email) return { status: "invalid-email" } as const;

      const auth = await getAuth();
      if (!auth) return { status: "unavailable" } as const;

      const requested = { status: "requested" } as const;
      try {
        await auth.signInWithOtp({ email });
      } catch {
        return requested;
      }
      return requested;
    },

    async verifyCode(rawEmail: unknown, rawCode: unknown) {
      const email = typeof rawEmail === "string" ? normalizeSignInEmail(rawEmail) : null;
      if (!email) return { status: "invalid-email" } as const;

      const otp = typeof rawCode === "string" ? rawCode.trim() : "";
      if (!/^\d{6}$/.test(otp)) return { status: "invalid-code" } as const;

      const auth = await getAuth();
      if (!auth) return { status: "unavailable" } as const;

      try {
        const { data, error } = await auth.verifyOtp({ email, otp });
        if (error || !data?.user?.id) return { status: "invalid-code" } as const;
        return { status: "verified" } as const;
      } catch {
        return { status: "unavailable" } as const;
      }
    },
  };
}
