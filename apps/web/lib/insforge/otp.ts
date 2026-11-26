import type { InsForgeError } from "@insforge/sdk";
import { type CookieStore, createAuthActions } from "@insforge/sdk/ssr";
import type { DataBackend } from "../backend-flag";
import { normalizeSignInEmail } from "../email-link-sign-in";

type OtpConfig = {
  backend: DataBackend;
  url?: string;
  anonKey?: string;
};

function isProviderUnavailable({ statusCode, error }: InsForgeError): boolean {
  return statusCode === 0 || error === "REQUEST_TIMEOUT" || (statusCode >= 500 && statusCode < 600);
}

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

      try {
        const { error } = await auth.signInWithOtp({ email });
        if (error && isProviderUnavailable(error)) return { status: "unavailable" } as const;
        return { status: "requested" } as const;
      } catch {
        return { status: "unavailable" } as const;
      }
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
        if (error && (error.statusCode === 429 || isProviderUnavailable(error))) {
          return { status: "unavailable" } as const;
        }
        if (error || !data?.user?.id) return { status: "invalid-code" } as const;
        return { status: "verified" } as const;
      } catch {
        return { status: "unavailable" } as const;
      }
    },
  };
}
