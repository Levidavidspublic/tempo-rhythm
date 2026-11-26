import type { useAuthActions as useConvexAuthActions } from "@convex-dev/auth/react";
import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DataBackend } from "../backend-flag";

const realModules = {
  "@convex-dev/auth/react": { ...(await import("@convex-dev/auth/react")) },
  "convex/react": { ...(await import("convex/react")) },
  "next/navigation": { ...(await import("next/navigation")) },
  "@/app/sign-in/insforge-actions": { ...(await import("@/app/sign-in/insforge-actions")) },
  "@/lib/backend-flag": { ...(await import("@/lib/backend-flag")) },
};
const requestCode =
  mock<(typeof realModules)["@/app/sign-in/insforge-actions"]["requestInsforgeOtp"]>();
const verifyCode =
  mock<(typeof realModules)["@/app/sign-in/insforge-actions"]["verifyInsforgeOtp"]>();
type ConvexSignIn = ReturnType<typeof useConvexAuthActions>["signIn"];
const signIn = mock<ConvexSignIn>(async () => ({ signingIn: false }));
const useConvexAuth = mock(() => ({ isAuthenticated: false, isLoading: false }));
const useAuthActions = mock(() => ({ signIn }));
const push = mock<(href: string) => void>();
const replace = mock<(href: string) => void>();

function setBackend(backend: DataBackend) {
  const flagModule = { ...realModules["@/lib/backend-flag"] };
  flagModule.DATA_BACKEND = backend;
  mock.module("@/lib/backend-flag", () => flagModule);
}

mock.module("@convex-dev/auth/react", () => ({
  ...realModules["@convex-dev/auth/react"],
  useAuthActions,
}));
mock.module("convex/react", () => ({ ...realModules["convex/react"], useConvexAuth }));
mock.module("next/navigation", () => ({
  ...realModules["next/navigation"],
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams({ next: "/tasks?view=week" }),
}));
mock.module("@/app/sign-in/insforge-actions", () => ({
  requestInsforgeOtp: requestCode,
  verifyInsforgeOtp: verifyCode,
}));

const { default: SignInPage } = await import("@/app/sign-in/page");
const { default: VerifyPage } = await import("@/app/sign-in/verify/page");
const {
  clearPendingInsforgeOtp,
  finishInsforgeSignIn,
  getPendingInsforgeOtp,
  getPostAuthDestination,
  requestInsforgeCode,
  sendConvexMagicLink,
  SignInForm,
  startInsforgeSignIn,
} = await import("@/components/auth/SignInForm");

beforeEach(() => {
  setBackend("insforge");
  clearPendingInsforgeOtp();
  requestCode.mockReset().mockResolvedValue({ status: "requested" });
  verifyCode.mockReset().mockResolvedValue({ status: "verified" });
  signIn.mockClear();
  useConvexAuth.mockClear();
  useAuthActions.mockClear();
  push.mockClear();
  replace.mockClear();
});

afterAll(() => {
  clearPendingInsforgeOtp();
  for (const [path, real] of Object.entries(realModules)) mock.module(path, () => real);
});

test("InsForge renders OTP on the page and in the modal without calling Convex auth hooks", () => {
  const page = renderToStaticMarkup(createElement(SignInPage));
  const modal = renderToStaticMarkup(createElement(SignInForm, { variant: "modal" }));
  expect(page).toContain("Request sign-in code");
  expect(page).toContain('id="sign-in-email"');
  expect(modal).toContain("Request sign-in code");
  expect(modal).not.toContain("Send magic link");
  expect(useConvexAuth).not.toHaveBeenCalled();
  expect(useAuthActions).not.toHaveBeenCalled();
});

const NON_OTP_BACKENDS = ["convex", "firebase"] as const;

test.each(NON_OTP_BACKENDS)("%s keeps magic links on the page and in the modal", (backend) => {
  setBackend(backend);
  const page = renderToStaticMarkup(createElement(SignInPage));
  const modal = renderToStaticMarkup(createElement(SignInForm, { variant: "modal" }));
  expect(page).toContain("Send magic link");
  expect(page).toContain("/sign-up?next=%2Ftasks%3Fview%3Dweek");
  expect(modal).toContain("Send magic link");
  expect(useConvexAuth).toHaveBeenCalledTimes(1);
  expect(useAuthActions).toHaveBeenCalledTimes(2);
  expect(requestCode).not.toHaveBeenCalled();
  expect(() => renderToStaticMarkup(createElement(VerifyPage))).toThrow("NEXT_REDIRECT");
});

test("the Convex Resend request preserves the callback path and omits it when absent", async () => {
  await sendConvexMagicLink(signIn, "learner@example.test", "/tasks?view=week");
  await sendConvexMagicLink(signIn, "learner@example.test");
  expect(signIn.mock.calls).toEqual([
    ["resend", { email: "learner@example.test", redirectTo: "/tasks?view=week" }],
    ["resend", { email: "learner@example.test" }],
  ]);
  expect(requestCode).not.toHaveBeenCalled();
});

test("direct verification without a pending request offers a return to sign-in", () => {
  const html = renderToStaticMarkup(createElement(VerifyPage));
  expect(html).toContain("Request a new code");
  expect(html).toContain('href="/sign-in"');
  expect(html).not.toContain("one-time-code");
  expect(verifyCode).not.toHaveBeenCalled();
});

test("a normalized email stays in memory and only a verified code follows the deep link", async () => {
  expect(
    await startInsforgeSignIn(" Learner@Example.Test ", "/tasks?view=week#top", push)
  ).toBeNull();
  expect(requestCode).toHaveBeenCalledWith("learner@example.test");
  expect(push.mock.calls).toEqual([["/sign-in/verify"]]);
  const challenge = getPendingInsforgeOtp();
  if (!challenge) throw new Error("Expected a pending OTP request");
  const html = renderToStaticMarkup(createElement(VerifyPage));
  expect(html).toMatch(/autocomplete="one-time-code"/i);
  expect(html).toContain("Verify code");
  expect(html).not.toContain(challenge.email);

  verifyCode.mockResolvedValueOnce({ status: "invalid-code" });
  expect(await finishInsforgeSignIn(challenge, "010203", replace)).toContain("didn't work");
  expect(verifyCode).toHaveBeenCalledWith("learner@example.test", "010203");
  expect(replace).not.toHaveBeenCalled();
  expect(getPendingInsforgeOtp()).toBe(challenge);

  expect(await finishInsforgeSignIn(challenge, "042943", replace)).toBeNull();
  expect(verifyCode).toHaveBeenLastCalledWith("learner@example.test", "042943");
  expect(replace.mock.calls).toEqual([["/tasks?view=week#top"]]);
  expect(getPendingInsforgeOtp()).toBeNull();
});

test("invalid emails and unavailable sends do not leave the sign-in form", async () => {
  expect(await startInsforgeSignIn("not-an-email", undefined, push)).toContain("valid email");
  expect(requestCode).not.toHaveBeenCalled();
  requestCode.mockResolvedValueOnce({ status: "unavailable" });
  expect(await startInsforgeSignIn("learner@example.test", undefined, push)).toContain("Try again");
  expect(getPendingInsforgeOtp()).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

test("verification and resend failures allow a retry without exposing transport details", async () => {
  await startInsforgeSignIn("learner@example.test", undefined, push);
  const challenge = getPendingInsforgeOtp();
  if (!challenge) throw new Error("Expected a pending OTP request");
  verifyCode.mockRejectedValueOnce(new Error("transport failure"));
  expect(await finishInsforgeSignIn(challenge, "241816", replace)).toContain("Try again");
  expect(replace).not.toHaveBeenCalled();

  requestCode.mockRejectedValueOnce(new Error("transport failure"));
  expect(await requestInsforgeCode(challenge.email)).toContain("Try again");
  expect(await requestInsforgeCode(challenge.email)).toBeNull();
  expect(requestCode).toHaveBeenLastCalledWith("learner@example.test");
  expect(push).toHaveBeenCalledTimes(1);
  expect(getPendingInsforgeOtp()).toBe(challenge);
});

test("an external next value never appears in a link or in the successful OTP redirect", async () => {
  await startInsforgeSignIn("learner@example.test", "/\\outside.example", push);
  const challenge = getPendingInsforgeOtp();
  if (!challenge) throw new Error("Expected a pending OTP request");
  expect(renderToStaticMarkup(createElement(VerifyPage))).not.toContain("outside.example");
  expect(await finishInsforgeSignIn(challenge, "241816", replace)).toBeNull();
  expect(replace.mock.calls).toEqual([["/today"]]);
});

test.each([
  "https://outside.example",
  "javascript:void(0)",
  "//outside.example",
  "/\\outside.example",
  "/%2foutside.example",
  "/%5coutside.example",
  "/tasks/..//outside.example",
  "/\t/outside.example",
  "/sign-in/verify",
  "/tasks/%2e%2e/%73ign-in#again",
  "/sign-up?next=/tasks",
  "/dashboard/legacy",
])("falls back to /today for the destination %j", (path) => {
  expect(getPostAuthDestination(path)).toBe("/today");
});
