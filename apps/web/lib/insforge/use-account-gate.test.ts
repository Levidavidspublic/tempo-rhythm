import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import type { DataBackend } from "@/lib/backend-flag";
import type { InsforgeSession } from "./session";

const realModules = {
  "@convex-dev/auth/react": { ...(await import("@convex-dev/auth/react")) },
  "convex/react": { ...(await import("convex/react")) },
  "next/navigation": { ...(await import("next/navigation")) },
  "@/lib/backend-flag": { ...(await import("@/lib/backend-flag")) },
  "@/lib/insforge/session": { ...(await import("@/lib/insforge/session")) },
  "@/lib/insforge/use-account-gate": { ...(await import("@/lib/insforge/use-account-gate")) },
};
const { readAccountGate } = realModules["@/lib/insforge/use-account-gate"];
const signedIn = { status: "signedIn", uid: "owner-id", email: "session@example.invalid" } as const;
const ownerColumn = "user_id";
const statusColumn = "approval_status";
const activeColumn = "is_active";
const deletedColumn = "deleted_at";
const row = {
  [ownerColumn]: signedIn.uid,
  [statusColumn]: "approved",
  role: "user",
  email: "owner@example.invalid",
  [activeColumn]: true,
  [deletedColumn]: null,
};
const approvedGate = { status: "approved", isAdmin: false, email: row.email } as const;
const protectedChild = "PROTECTED_CHILD";
const bypassFlag = "NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS";
const signOut = mock(async () => {});
const useAuthActions = mock(() => ({ signOut }));
type GateResult = Awaited<ReturnType<typeof readAccountGate>>;
const useQuery = mock<() => Exclude<GateResult, { status: "error" }> | undefined>();
const useMutation = mock(() => async () => {});
const useInsforgeSession = mock<() => InsforgeSession>();
const useAccountGate =
  mock<
    (
      session: InsforgeSession
    ) => ReturnType<(typeof realModules)["@/lib/insforge/use-account-gate"]["useAccountGate"]>
  >();

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

function setBackend(backend: DataBackend) {
  const flagModule = { ...realModules["@/lib/backend-flag"] };
  flagModule.DATA_BACKEND = backend;
  void mock.module("@/lib/backend-flag", () => flagModule);
}

void mock.module("@convex-dev/auth/react", () => ({
  ...realModules["@convex-dev/auth/react"],
  useAuthActions,
}));
void mock.module("convex/react", () => ({ ...realModules["convex/react"], useQuery, useMutation }));
void mock.module("next/navigation", () => ({
  ...realModules["next/navigation"],
  useRouter: () => ({ replace() {} }),
}));
void mock.module("@/lib/insforge/session", () => ({
  ...realModules["@/lib/insforge/session"],
  useInsforgeSession,
}));
void mock.module("@/lib/insforge/use-account-gate", () => ({
  ...realModules["@/lib/insforge/use-account-gate"],
  useAccountGate,
}));

const { ApprovalGate } = await import("@/components/approval/ApprovalGate");
const renderGate = () =>
  renderToStaticMarkup(
    createElement(LocaleProvider, null, createElement(ApprovalGate, null, protectedChild))
  );

let previousBypass: string | undefined;
let previousNodeEnv: string | undefined;
beforeEach(() => {
  previousBypass = process.env[bypassFlag];
  previousNodeEnv = process.env.NODE_ENV;
  setEnv(bypassFlag, undefined);
  setEnv("NODE_ENV", "test");
  setBackend("insforge");
  useAuthActions.mockClear();
  useMutation.mockClear();
  useQuery.mockReset();
  useInsforgeSession.mockReset().mockReturnValue(signedIn);
  useAccountGate.mockReset();
});

afterEach(() => {
  setEnv(bypassFlag, previousBypass);
  setEnv("NODE_ENV", previousNodeEnv);
});

afterAll(() => {
  for (const [path, real] of Object.entries(realModules)) void mock.module(path, () => real);
});

describe("account gate read", () => {
  test("selects only the verified session's account gate and returns the Convex shape", async () => {
    const select = mock(async () => [row]);
    expect(await readAccountGate(signedIn, () => ({ select }))).toEqual(approvedGate);
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith(
      { table: "account_gate", uid: signedIn.uid },
      { select: "user_id,approval_status,role,email,is_active,deleted_at", filters: [] }
    );
  });

  const restrictiveStatuses: ("pending" | "revoked")[] = ["pending", "revoked"];
  test.each(restrictiveStatuses)("preserves stored %s for a regular account", async (status) => {
    const select = async () => [{ ...row, [statusColumn]: status }];
    const expected = { ...approvedGate, status };
    expect(await readAccountGate(signedIn, () => ({ select }))).toEqual(expected);
  });

  const adminStatuses: ("pending" | "approved" | "revoked")[] = ["pending", "approved", "revoked"];
  test.each(adminStatuses)("preserves stored %s for an admin, matching SQL", async (status) => {
    const select = async () => [
      { ...row, [statusColumn]: status, role: "admin", email: null, [activeColumn]: null },
    ];
    expect(await readAccountGate(signedIn, () => ({ select }))).toEqual({
      status,
      isAdmin: true,
      email: signedIn.email,
    });
  });

  test.each([
    ["no row", []],
    ["duplicate rows", [row, row]],
    ["wrong owner", [{ ...row, [ownerColumn]: "other-owner" }]],
    ["inactive", [{ ...row, [activeColumn]: false }]],
    ["soft deleted", [{ ...row, [deletedColumn]: 0 }]],
    ["inactive admin", [{ ...row, role: "admin", [activeColumn]: false }]],
    ["unknown status", [{ ...row, [statusColumn]: "unknown" }]],
    ["missing activity state", [{ ...row, [activeColumn]: undefined }]],
    ["malformed response", { row }],
  ])("fails closed on %s", async (_label, result) => {
    expect(await readAccountGate(signedIn, () => ({ select: async () => result }))).toBeNull();
  });

  test("distinguishes an unavailable or failing transport from a missing row", async () => {
    const readError = { status: "error" } as const;
    expect(await readAccountGate(signedIn, () => null)).toEqual(readError);
    const select = async () => {
      throw new Error("unavailable");
    };
    expect(await readAccountGate(signedIn, () => ({ select }))).toEqual(readError);
    expect(await readAccountGate(signedIn, () => ({ select: async () => [] }))).toBeNull();
  });
});

describe("ApprovalGate render", () => {
  test("InsForge approved renders content without querying Convex", () => {
    useAccountGate.mockReturnValue(approvedGate);
    expect(renderGate()).toContain(protectedChild);
    expect(useAccountGate).toHaveBeenCalledWith(signedIn);
    expect(useQuery).not.toHaveBeenCalled();
  });

  const pendingAdmin = { ...approvedGate, status: "pending", isAdmin: true } as const;
  const revokedAdmin = { ...approvedGate, status: "revoked", isAdmin: true } as const;
  const waitingScreens = [
    ["pending", { ...approvedGate, status: "pending" }, "Waiting for approval"],
    ["revoked", { ...approvedGate, status: "revoked" }, "Your access is paused"],
    ["pending admin", pendingAdmin, "Waiting for approval"],
    ["revoked admin", revokedAdmin, "Your access is paused"],
    ["inactive or missing", null, "Your access is paused"],
  ] as const;
  test.each(waitingScreens)("InsForge %s omits Convex actions", (_label, gate, title) => {
    useAccountGate.mockReturnValue(gate);
    const html = renderGate();
    expect(html).toContain(title);
    expect(html).not.toContain(protectedChild);
    expect(html).not.toContain("approval-name");
    expect(html).toContain("Sign out");
    expect(useQuery).not.toHaveBeenCalled();
    expect(useMutation).not.toHaveBeenCalled();
    expect(useAuthActions).not.toHaveBeenCalled();
  });

  test("a read error shows the localized retry message without mounting content", () => {
    useAccountGate.mockReturnValue({ status: "error" });
    const html = renderGate();
    expect(html).toContain('role="alert"');
    expect(html).toContain("That didn&#x27;t go through. Try again.");
    expect(html).not.toContain("Your access is paused");
    expect(html).not.toContain(protectedChild);
    expect(useQuery).not.toHaveBeenCalled();
  });

  test("an unresolved gate shows the skeleton without mounting content", () => {
    const html = renderGate();
    expect(html).toContain("approval-loading");
    expect(html).not.toContain(protectedChild);
  });

  const noSessionStates: ("loading" | "signedOut")[] = ["loading", "signedOut"];
  test.each(noSessionStates)("session %s cannot reuse an approved result", (status) => {
    useInsforgeSession.mockReturnValue({ status });
    useAccountGate.mockReturnValue(approvedGate);
    expect(renderGate()).not.toContain(protectedChild);
  });

  test("the Convex path keeps its query, render behavior and waiting controls", () => {
    setBackend("convex");
    expect(renderGate()).toContain("approval-loading");
    useQuery.mockReturnValueOnce(null).mockReturnValueOnce(approvedGate);
    expect(renderGate()).toContain(protectedChild);
    expect(renderGate()).toContain(protectedChild);
    useQuery.mockReturnValue({ ...approvedGate, status: "pending" });
    const html = renderGate();
    expect(html).toContain("Waiting for approval");
    expect(html).toContain("approval-name");
    expect(html).toContain("Sign out");
    expect(useMutation).toHaveBeenCalledTimes(1);
    expect(useAuthActions).toHaveBeenCalledTimes(1);
    expect(useInsforgeSession).not.toHaveBeenCalled();
  });

  test("the existing E2E bypass skips both providers and account gate reads", async () => {
    setEnv(bypassFlag, "1");
    const getTransport = mock(() => null);
    expect(renderGate()).toContain(protectedChild);
    expect(useInsforgeSession).not.toHaveBeenCalled();
    expect(useAccountGate).not.toHaveBeenCalled();
    expect(useQuery).not.toHaveBeenCalled();
    expect(await readAccountGate(signedIn, getTransport)).toBeNull();
    expect(getTransport).not.toHaveBeenCalled();
  });

  test("production ignores the E2E bypass flag", () => {
    setEnv("NODE_ENV", "production");
    setEnv(bypassFlag, "1");
    useInsforgeSession.mockReturnValue({ status: "signedOut" });
    expect(renderGate()).not.toContain(protectedChild);
    expect(useInsforgeSession).toHaveBeenCalledTimes(1);
  });
});
