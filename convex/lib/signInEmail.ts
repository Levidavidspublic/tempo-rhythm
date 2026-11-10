/**
 * The magic-link sign-in email (TEMPO-B07-18).
 *
 * `signInEmail` is pure: it builds the subject, the HTML part and the text part from the link and
 * its host. English first, then Hebrew (right to left). No images, no tracking, inline styles
 * only, and every block sets both its text colour and its background so dark-mode clients never
 * end up with light text on a light ground.
 *
 * `sendSignInEmail` is the Resend provider's `sendVerificationRequest` (convex/auth.ts). It sends
 * exactly what Auth.js's default does (node_modules/@auth/core/providers/resend.js): the same
 * Resend API, the same key (`provider.apiKey`, which Auth.js fills from AUTH_RESEND_KEY) and the
 * same sender (`provider.from`, RESEND_FROM_EMAIL in convex/auth.ts). Only the content differs.
 * Its errors name the HTTP status only, never the address, the link or the key.
 *
 * The copy says the link lasts 30 minutes. That is the Resend provider's `maxAge` in
 * convex/auth.ts; change both together.
 */

export type SignInEmail = { subject: string; html: string; text: string };

export const SIGN_IN_EMAIL_SUBJECT = "Your Tempo Flow sign-in link · קישור הכניסה שלכם";

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

// Tempo light palette (apps/web/app/globals.css). The button pair is 6:1 contrast.
const PAGE = "#FBF9F4";
const CARD = "#FFFFFF";
const INK = "#1B1916";
const INK_MUTED = "#57514A";
const LINE = "#D9D0C1";
const ACCENT = "#A3461F";
const ON_ACCENT = "#FFFFFF";

/** Escapes text for an HTML text node or a double- or single-quoted attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraph(content: string, color: string, marginBottom = 16): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT};font-size:16px;line-height:24px;color:${color};background-color:${CARD};">${content}</p>`;
}

export function signInEmail({ url, host }: { url: string; host: string }): SignInEmail {
  const safeUrl = escapeHtml(url);
  const safeHost = escapeHtml(host);

  const english = [
    `<p style="margin:0 0 20px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;letter-spacing:0.02em;color:${INK_MUTED};background-color:${CARD};">Tempo Flow</p>`,
    paragraph(`This is your sign-in link for Tempo Flow on ${safeHost}.`, INK, 24),
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>`,
    `<td style="border-radius:8px;background-color:${ACCENT};">`,
    `<a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:${ON_ACCENT};background-color:${ACCENT};border:1px solid ${ACCENT};border-radius:8px;text-decoration:none;">Sign in to Tempo Flow</a>`,
    "</td></tr></table>",
    `<p style="margin:24px 0 8px;font-family:${FONT};font-size:14px;line-height:20px;color:${INK_MUTED};background-color:${CARD};">Or copy this link into your browser:</p>`,
    `<p style="margin:0 0 24px;padding:12px;font-family:${MONO};font-size:13px;line-height:19px;color:${INK};background-color:${PAGE};border:1px solid ${LINE};border-radius:6px;word-break:break-all;">${safeUrl}</p>`,
    paragraph("The link works for 30 minutes and only once.", INK),
    paragraph(
      "If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.",
      INK,
      0
    ),
  ].join("\n");

  const hebrew = [
    paragraph(`זה קישור הכניסה שלכם ל-Tempo Flow באתר <span dir="ltr">${safeHost}</span>.`, INK),
    paragraph("כדי להיכנס, לחצו על הכפתור למעלה, או העתיקו לדפדפן את הקישור שמתחתיו.", INK),
    paragraph("הקישור עובד במשך 30 דקות ופעם אחת בלבד.", INK),
    paragraph(
      "אם לא ביקשתם את זה, אפשר להתעלם מהמייל הזה. אף אחד לא יכול להיכנס בלי הקישור.",
      INK,
      0
    ),
  ].join("\n");

  const html = [
    "<!doctype html>",
    '<html lang="en" dir="ltr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(SIGN_IN_EMAIL_SUBJECT)}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;font-family:${FONT};color:${INK};background-color:${PAGE};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">`,
    `<tr><td align="center" style="padding:32px 16px;background-color:${PAGE};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;border-collapse:separate;color:${INK};background-color:${CARD};border:1px solid ${LINE};border-radius:12px;">`,
    `<tr><td dir="ltr" lang="en" style="padding:32px 28px 28px;font-family:${FONT};text-align:left;color:${INK};background-color:${CARD};">`,
    english,
    "</td></tr>",
    `<tr><td style="padding:0 28px;background-color:${CARD};"><div style="height:1px;line-height:1px;font-size:1px;background-color:${LINE};">&nbsp;</div></td></tr>`,
    `<tr><td dir="rtl" lang="he" style="padding:28px 28px 32px;font-family:${FONT};text-align:right;color:${INK};background-color:${CARD};">`,
    hebrew,
    "</td></tr>",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("\n");

  const text = [
    "Tempo Flow",
    "",
    `This is your sign-in link for Tempo Flow on ${host}.`,
    "",
    "Open this link to sign in:",
    url,
    "",
    "The link works for 30 minutes and only once.",
    "",
    "If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.",
    "",
    "---",
    "",
    `זה קישור הכניסה שלכם ל-Tempo Flow באתר ${host}.`,
    "כדי להיכנס, פתחו את הקישור שלמעלה.",
    "",
    "הקישור עובד במשך 30 דקות ופעם אחת בלבד.",
    "",
    "אם לא ביקשתם את זה, אפשר להתעלם מהמייל הזה. אף אחד לא יכול להיכנס בלי הקישור.",
    "",
  ].join("\n");

  return { subject: SIGN_IN_EMAIL_SUBJECT, html, text };
}

/** The part of Auth.js's `sendVerificationRequest` params this sender reads. */
export type SignInEmailRequest = {
  identifier: string;
  url: string;
  provider: { apiKey?: string; from?: string };
};

function sendError(reason: string | number): Error {
  return new Error(`Resend: could not send the sign-in email (${reason})`);
}

/**
 * Sends the sign-in email through Resend, the way Auth.js's default Resend
 * `sendVerificationRequest` does, with our subject, HTML and text.
 */
export async function sendSignInEmail(params: SignInEmailRequest): Promise<void> {
  const { identifier: to, provider, url } = params;

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    // `new URL` puts the input in its message; the input is the sign-in link.
    throw sendError("invalid link");
  }

  const { subject, html, text } = signInEmail({ url, host });

  let res: Response;
  try {
    res = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: provider.from, to, subject, html, text }),
    });
  } catch {
    throw sendError("network error");
  }

  if (!res.ok) {
    // Resend's error body can echo the request, so it is never read or rethrown.
    throw sendError(res.status);
  }
}
