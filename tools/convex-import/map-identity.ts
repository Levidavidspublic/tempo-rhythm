type ConvexDoc = { _id: string; _creationTime: number; [key: string]: unknown };
type SourceTable = "users" | "subscriptionStates";
type Rejection = { table: SourceTable; id: string; reason: string };

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.includes("\0")) {
    throw new Error(field + " must be text without null bytes");
  }
  return "E'" + value.replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
}

function oneOf(value: unknown, field: string, choices: readonly string[]): string {
  if (typeof value !== "string" || !choices.includes(value)) {
    throw new Error(field + " is not a supported value");
  }
  return text(value, field);
}

function millis(value: unknown, field: string): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(field + " must be an integer millisecond value");
  }
  return String(value);
}

function bool(value: unknown, field: string): string {
  if (typeof value !== "boolean") throw new Error(field + " must be boolean");
  return value ? "TRUE" : "FALSE";
}

function optional(
  doc: ConvexDoc,
  field: string,
  literal: (value: unknown, field: string) => string,
): string {
  return doc[field] == null ? "NULL" : literal(doc[field], field);
}

function dateColumns(doc: ConvexDoc) {
  const createdAt = doc.createdAt ?? Math.trunc(doc._creationTime);
  return {
    created_at: millis(createdAt, "createdAt"),
    updated_at: millis(doc.updatedAt ?? createdAt, "updatedAt"),
  };
}

function upsert(
  table: string,
  key: "legacy_convex_id" | "user_id",
  values: Record<string, string>,
  where: string,
) {
  const columns = Object.keys(values);
  const changes = columns.filter((column) => column !== "user_id" && column !== key);
  return [
    "INSERT INTO public." + table + " AS target (" + columns.join(", ") + ")",
    "SELECT " + Object.values(values).join(", ") + " WHERE " + where,
    "ON CONFLICT (" + key + ") DO UPDATE SET",
    changes.map((column) => "  " + column + " = excluded." + column).join(",\n"),
    "WHERE excluded.updated_at >= target.updated_at",
    "  AND ROW(" + changes.map((column) => "excluded." + column).join(", ") + ")",
    "    IS DISTINCT FROM ROW(" + changes.map((column) => "target." + column).join(", ") + ");",
  ].join("\n");
}

function countBy(docs: readonly ConvexDoc[], key: (doc: ConvexDoc) => string | undefined) {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    const value = key(doc);
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function mapIdentity(users: readonly ConvexDoc[], subscriptionStates: readonly ConvexDoc[]) {
  const rejected: Rejection[] = [];
  const sql = ["BEGIN;"];
  const normalizedEmail = (doc: ConvexDoc) =>
    typeof doc.email === "string" ? doc.email.trim().toLowerCase() : undefined;
  const emails = countBy(users, normalizedEmail);
  const userIds = countBy(users, (doc) => doc._id);
  const usersMapped = new Map<string, string>();

  for (const user of users) {
    try {
      const email = normalizedEmail(user);
      if (!email) throw new Error("missing email");
      if (emails.get(email) !== 1) throw new Error("duplicate email (case-insensitive)");
      if (!user._id || userIds.get(user._id) !== 1) throw new Error("missing or duplicate user ID");

      const legacy = text(user._id, "_id");
      const emailSql = text(email, "email");
      const dates = dateColumns(user);
      const sameEmail = "pg_catalog.lower(email) = pg_catalog.lower(" + emailSql + ")";
      const authId = "(SELECT (array_agg(id))[1] FROM auth.users WHERE " +
        sameEmail + " HAVING count(*) = 1)";
      const sameLegacy = "(SELECT user_id FROM public.account_gate WHERE legacy_convex_id = " + legacy + ")";
      const owner = "(SELECT " + authId + " WHERE (" + sameLegacy + " IS NULL OR " +
        sameLegacy + " = " + authId + ") AND NOT EXISTS (SELECT 1 FROM public.account_gate WHERE user_id = " +
        authId + " AND legacy_convex_id <> " + legacy + "))";
      const resolved = owner + " IS NOT NULL";
      const gateValues = {
        user_id: owner,
        email: emailSql,
        email_verified: optional(user, "emailVerified", bool),
        email_verification_time: optional(user, "emailVerificationTime", millis),
        role: optional(user, "role", (value, field) => oneOf(value, field, ["admin", "user"])),
        user_type: optional(user, "userType", (value, field) => oneOf(value, field, ["free", "paid"])),
        beta_access: optional(user, "betaAccess", (value, field) => oneOf(value, field, ["none", "tester", "founder"])),
        entitlement_tier: optional(user, "entitlementTier", (value, field) =>
          oneOf(value, field, ["none", "basic", "pro", "max", "god"])),
        is_god_tier: optional(user, "isGodTier", bool),
        beta_approved_at: optional(user, "betaApprovedAt", millis),
        is_active: optional(user, "isActive", bool),
        approval_status: oneOf(user.approvalStatus ?? "approved", "approvalStatus", ["pending", "approved", "revoked"]),
        approval_updated_at: optional(user, "approvalUpdatedAt", millis),
        approval_updated_by: optional(user, "approvalUpdatedBy", text),
        legacy_convex_id: legacy,
        ...dates,
        deleted_at: optional(user, "deletedAt", millis),
      };
      const profileValues = {
        user_id: owner,
        name: optional(user, "name", text),
        full_name: optional(user, "fullName", text),
        onboarded_at: optional(user, "onboardedAt", millis),
        ...dates,
      };
      sql.push(
        "INSERT INTO auth.users (email, email_verified) SELECT " + emailSql + ", " +
          bool(user.emailVerified ?? false, "emailVerified") + " WHERE " + sameLegacy +
          " IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE " + sameEmail +
          ") ON CONFLICT (email) DO NOTHING;",
        "SELECT 'users' AS \"table\", " + legacy +
          " AS id, 'email cannot resolve to a unique, unclaimed auth user' AS reason WHERE NOT (" + resolved + ");",
        "UPDATE public.profiles SET updated_at = least(updated_at, " + dates.updated_at +
          ") WHERE user_id = " + owner + " AND EXISTS (SELECT 1 FROM public.account_gate" +
          " WHERE user_id = " + owner + " AND legacy_convex_id IS NULL);",
        upsert("profiles", "user_id", profileValues, resolved),
        "UPDATE public.account_gate SET legacy_convex_id = " + legacy + ", updated_at = least(updated_at, " +
          dates.updated_at + ") WHERE user_id = " + owner + " AND legacy_convex_id IS NULL;",
        upsert("account_gate", "legacy_convex_id", gateValues, resolved),
      );
      usersMapped.set(user._id, emailSql);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejected.push({ table: "users", id: user._id, reason: error.message });
    }
  }

  const subscriptionOwners = countBy(subscriptionStates, (doc) =>
    typeof doc.userId === "string" ? doc.userId : undefined);
  const subscriptionIds = countBy(subscriptionStates, (doc) => doc._id);
  for (const subscription of subscriptionStates) {
    try {
      const userId = subscription.userId;
      const emailSql = typeof userId === "string" ? usersMapped.get(userId) : undefined;
      if (!emailSql || typeof userId !== "string") throw new Error("unresolved userId");
      if (subscriptionOwners.get(userId) !== 1) throw new Error("duplicate subscription for userId");
      if (!subscription._id || subscriptionIds.get(subscription._id) !== 1) {
        throw new Error("missing or duplicate subscription ID");
      }
      const legacy = text(subscription._id, "_id");
      const owner = "(SELECT gate.user_id FROM public.account_gate AS gate JOIN auth.users AS auth_user" +
        " ON auth_user.id = gate.user_id WHERE gate.legacy_convex_id = " + text(userId, "userId") +
        " AND pg_catalog.lower(auth_user.email) = pg_catalog.lower(" + emailSql + ")" +
        " AND (SELECT count(*) FROM auth.users WHERE pg_catalog.lower(email) = pg_catalog.lower(" + emailSql + ")) = 1)";
      const resolved = owner + " IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subscription_states" +
        " WHERE legacy_convex_id = " + legacy + " AND user_id <> " + owner + ")";
      const dates = dateColumns(subscription);
      const values = {
        user_id: owner,
        plan: oneOf(subscription.plan, "plan", ["none", "trial", "basic", "pro", "max"]),
        billing_cycle: oneOf(subscription.billingCycle, "billingCycle", ["none", "monthly", "annual", "lifetime"]),
        status: oneOf(subscription.status, "status", ["inactive", "active", "grace", "cancelled"]),
        trial_used: bool(subscription.trialUsed, "trialUsed"),
        source: optional(subscription, "source", text),
        legacy_convex_id: legacy,
        ...dates,
      };
      sql.push(
        "SELECT 'subscriptionStates' AS \"table\", " + legacy +
          " AS id, 'userId cannot resolve to the subscription owner' AS reason WHERE NOT (" + resolved + ");",
        "UPDATE public.subscription_states SET legacy_convex_id = " + legacy +
          ", updated_at = least(updated_at, " + dates.updated_at + ") WHERE id = " +
          "(SELECT (array_agg(id))[1] FROM public.subscription_states WHERE user_id = " + owner +
          " AND legacy_convex_id IS NULL AND source = 'open_signup_grant' HAVING count(*) = 1)" +
          " AND " + resolved + " AND NOT EXISTS (SELECT 1 FROM public.subscription_states WHERE legacy_convex_id = " + legacy + ");",
        upsert("subscription_states", "legacy_convex_id", values, resolved),
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      rejected.push({ table: "subscriptionStates", id: subscription._id, reason: error.message });
    }
  }

  const subscriptionsRejected = rejected.length - (users.length - usersMapped.size);
  const counts = {
    users: { exported: users.length, transformed: usersMapped.size, rejected: users.length - usersMapped.size },
    subscriptionStates: {
      exported: subscriptionStates.length,
      transformed: subscriptionStates.length - subscriptionsRejected,
      rejected: subscriptionsRejected,
    },
  };
  return { sql: [...sql, "COMMIT;", ""].join("\n"), rejected, counts };
}
