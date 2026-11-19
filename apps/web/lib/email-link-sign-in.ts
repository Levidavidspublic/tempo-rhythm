const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const OOB_CODE_SHAPE = /^[A-Za-z0-9_-]+$/;
const OOB_CODE_MAX_LENGTH = 512;

export function normalizeSignInEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();

  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(email)) {
    return null;
  }

  return email;
}

export type EmailSignInLink = Readonly<{ oobCode: string }>;

export function parseEmailSignInLink(href: string): EmailSignInLink | null {
  let url: URL;

  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const isAllowedOrigin =
    url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  const oobCode = url.searchParams.get("oobCode");

  if (
    !isAllowedOrigin ||
    url.searchParams.get("mode") !== "signIn" ||
    !oobCode ||
    oobCode.length > OOB_CODE_MAX_LENGTH ||
    !OOB_CODE_SHAPE.test(oobCode)
  ) {
    return null;
  }

  return { oobCode };
}

export const EMAIL_SIGN_IN_STATES = [
  "idle",
  "sending",
  "sent",
  "confirm_email",
  "signing_in",
  "expired",
  "unavailable",
] as const;

export type EmailSignInState = (typeof EMAIL_SIGN_IN_STATES)[number];

type EmailSignInCopy = Readonly<{ title: string; body: string }>;

const EMAIL_SIGN_IN_COPY: Readonly<Record<EmailSignInState, EmailSignInCopy>> = {
  idle: {
    title: "Sign in with your email",
    body: "We'll send you a secure link to sign in.",
  },
  sending: {
    title: "Sending your link",
    body: "This will only take a moment.",
  },
  sent: {
    title: "Check your inbox",
    body: "Open the link in the email to continue.",
  },
  confirm_email: {
    title: "Confirm your email",
    body: "Type your email once more to finish signing in.",
  },
  signing_in: {
    title: "Signing you in",
    body: "Your Tempo Flow is nearly ready.",
  },
  expired: {
    title: "That link has expired",
    body: "You can request a fresh link and continue.",
  },
  unavailable: {
    title: "Sign-in is taking a pause",
    body: "Please try again in a little while.",
  },
};

export function emailSignInCopy(state: EmailSignInState): EmailSignInCopy {
  return EMAIL_SIGN_IN_COPY[state];
}

export function nextEmailSignInState(input: {
  link: EmailSignInLink | null;
  rememberedEmail: string | null;
}): EmailSignInState {
  if (!input.link) {
    return "idle";
  }

  return input.rememberedEmail && normalizeSignInEmail(input.rememberedEmail)
    ? "signing_in"
    : "confirm_email";
}
