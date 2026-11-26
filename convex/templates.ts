import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  isStarterTemplateId,
  sectionsFromBody,
  starterById,
  starterForPeriod,
  STARTER_TEMPLATES,
  type PeriodType,
  type StarterTemplate,
} from "./lib/templateCatalog";
import { requireUser } from "./lib/requireUser";

const periodTypeValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("none"),
);

const templateValidator = v.object({
  templateId: v.string(),
  source: v.union(v.literal("starter"), v.literal("user")),
  name: v.string(),
  description: v.optional(v.string()),
  periodType: periodTypeValidator,
  sections: v.array(v.string()),
  body: v.string(),
  updatedAt: v.optional(v.number()),
});

const proposalValidator = v.object({
  templateId: v.string(),
  name: v.string(),
  reason: v.string(),
});

type TemplateView = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: PeriodType;
  sections: string[];
  body: string;
  updatedAt?: number;
};

function viewFromStarter(template: StarterTemplate): TemplateView {
  const view: TemplateView = {
    templateId: template.templateId,
    source: "starter",
    name: template.name,
    periodType: template.periodType,
    sections: sectionsFromBody(template.body),
    body: template.body,
  };
  if (template.description) {
    view.description = template.description;
  }
  return view;
}

function viewFromUser(doc: Doc<"templates">): TemplateView {
  const view: TemplateView = {
    templateId: doc._id,
    source: "user",
    name: doc.name,
    periodType: doc.periodType,
    sections: sectionsFromBody(doc.body),
    body: doc.body,
    updatedAt: doc.updatedAt,
  };
  if (doc.description) {
    view.description = doc.description;
  }
  return view;
}

async function listMine(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("templates")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return rows
    .filter((row) => row.deletedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const PROPOSAL_REASON: Record<Exclude<PeriodType, "none">, string> = {
  daily: "A daily page gives this day a short outline you can fill in.",
  weekly: "A weekly page groups the week into a few outcomes and a day-by-day list.",
  monthly: "A monthly page holds the month as a theme, four weeks, and open loops.",
};

export const list = query({
  args: {
    scope: v.optional(v.union(v.literal("all"), v.literal("starter"), v.literal("mine"))),
  },
  returns: v.array(templateValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const scope = args.scope ?? "all";
    const starters = scope === "mine" ? [] : STARTER_TEMPLATES.map(viewFromStarter);
    const mine =
      scope === "starter" ? [] : (await listMine(ctx, user._id)).map(viewFromUser);
    return [...starters, ...mine];
  },
});

export const get = query({
  args: { templateId: v.string() },
  returns: v.union(templateValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const starter = starterById(args.templateId);
    if (starter) {
      return viewFromStarter(starter);
    }
    const templateId = ctx.db.normalizeId("templates", args.templateId);
    if (!templateId) {
      return null;
    }
    const doc = await ctx.db.get(templateId);
    if (!doc || doc.deletedAt !== undefined || doc.userId !== user._id) {
      return null;
    }
    return viewFromUser(doc);
  },
});

export const proposeForPage = query({
  args: {
    periodType: periodTypeValidator,
    title: v.optional(v.string()),
  },
  returns: v.union(proposalValidator, v.null()),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const starter = starterForPeriod(args.periodType);
    if (!starter || args.periodType === "none") {
      return null;
    }
    const title = args.title?.trim();
    const reason = title
      ? `${PROPOSAL_REASON[args.periodType]} It fits "${title}".`
      : PROPOSAL_REASON[args.periodType];
    return {
      templateId: starter.templateId,
      name: starter.name,
      reason,
    };
  },
});

export const applyToNote = mutation({
  args: {
    templateId: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const resolved = await resolveTemplate(ctx, user._id, args.templateId);
    const title = args.title?.trim() || resolved.name;
    const now = Date.now();
    return await ctx.db.insert("notes", {
      userId: user._id,
      title,
      body: resolved.body,
      pinned: false,
      periodType: resolved.periodType,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    periodType: periodTypeValidator,
    body: v.string(),
  },
  returns: v.id("templates"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Name is required");
    }
    const description = args.description?.trim();
    const now = Date.now();
    return await ctx.db.insert("templates", {
      userId: user._id,
      name,
      ...(description ? { description } : {}),
      periodType: args.periodType,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    periodType: v.optional(periodTypeValidator),
    body: v.optional(v.string()),
  },
  returns: v.id("templates"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (isStarterTemplateId(args.templateId)) {
      throw new Error("Starter templates cannot be changed");
    }
    const doc = await ownedTemplate(ctx, user._id, args.templateId);
    const patch: {
      name?: string;
      description?: string;
      periodType?: PeriodType;
      body?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) {
        throw new Error("Name is required");
      }
      patch.name = name;
    }
    if (args.description !== undefined) {
      const description = args.description.trim();
      // Convex db.patch removes a field when its patch value is undefined.
      patch.description = description.length > 0 ? description : undefined;
    }
    if (args.periodType !== undefined) {
      patch.periodType = args.periodType;
    }
    if (args.body !== undefined) {
      patch.body = args.body;
    }
    await ctx.db.patch(doc._id, patch);
    return doc._id;
  },
});

export const remove = mutation({
  args: { templateId: v.id("templates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (isStarterTemplateId(args.templateId)) {
      throw new Error("Starter templates cannot be removed");
    }
    const doc = await ownedTemplate(ctx, user._id, args.templateId);
    const now = Date.now();
    await ctx.db.patch(doc._id, { deletedAt: now, updatedAt: now });
    return null;
  },
});

async function resolveTemplate(
  ctx: MutationCtx,
  userId: Id<"users">,
  templateId: string,
): Promise<{ name: string; body: string; periodType: PeriodType }> {
  const starter = starterById(templateId);
  if (starter) {
    return starter;
  }
  if (isStarterTemplateId(templateId)) {
    throw new Error("Template not found");
  }
  const id = ctx.db.normalizeId("templates", templateId);
  if (!id) {
    throw new Error("Template not found");
  }
  const doc = await ownedTemplate(ctx, userId, id);
  return doc;
}

async function ownedTemplate(
  ctx: MutationCtx,
  userId: Id<"users">,
  templateId: Id<"templates">,
): Promise<Doc<"templates">> {
  const doc = await ctx.db.get(templateId);
  if (!doc || doc.deletedAt !== undefined) {
    throw new Error("Template not found");
  }
  if (doc.userId !== userId) {
    throw new Error("Access denied");
  }
  return doc;
}
