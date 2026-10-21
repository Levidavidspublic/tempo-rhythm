import { v } from 'convex/values';
import { mutation, query, action } from './_generated/server';
import { api } from './_generated/api';
import { requireApprovedForAi } from './lib/aiGate';
import { callLLM } from './lib/ai_router';

// Memory sector type
export type MemorySector = 'semantic' | 'episodic' | 'procedural' | 'emotional' | 'general';

// Query: Get all memories for a user, optionally filtered by sector
export const queryMemories = query({
  args: {
    sector: v.optional(v.union(
      v.literal('semantic'),
      v.literal('episodic'),
      v.literal('procedural'),
      v.literal('emotional'),
      v.literal('general')
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Find user by email
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    let query = ctx.db
      .query('memories')
      .withIndex('by_userId_salience', (q) => q.eq('userId', user._id));

    const memories = await query
      .order('desc')
      .collect();

    // Filter by sector if provided
    let filtered = args.sector
      ? memories.filter((m) => m.sector === args.sector)
      : memories;

    // Sort by salience (descending) and lastAccessed (descending)
    filtered.sort((a, b) => {
      if (b.salience !== a.salience) {
        return b.salience - a.salience;
      }
      return b.lastAccessed - a.lastAccessed;
    });

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

// Mutation: Add a new memory
export const addMemory = mutation({
  args: {
    content: v.string(),
    sector: v.optional(v.union(
      v.literal('semantic'),
      v.literal('episodic'),
      v.literal('procedural'),
      v.literal('emotional'),
      v.literal('general')
    )),
    salience: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const now = Date.now();
    const memoryId = await ctx.db.insert('memories', {
      userId: user._id,
      content: args.content,
      sector: args.sector || 'general',
      salience: args.salience ?? 0.5,
      decayRate: 0.1,
      lastAccessed: now,
      accessCount: 0,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return memoryId;
  },
});

// Mutation: Update memory salience
export const updateSalience = mutation({
  args: {
    memoryId: v.id('memories'),
    salience: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== user._id) {
      throw new Error('Memory not found or access denied');
    }

    // Clamp salience between 0.1 and 1.0
    const clampedSalience = Math.max(0.1, Math.min(1.0, args.salience));

    await ctx.db.patch(args.memoryId, {
      salience: clampedSalience,
      lastAccessed: Date.now(),
      accessCount: memory.accessCount + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Mutation: Delete a memory
export const deleteMemory = mutation({
  args: {
    memoryId: v.id('memories'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== user._id) {
      throw new Error('Memory not found or access denied');
    }

    await ctx.db.delete(args.memoryId);
    return { success: true };
  },
});

// Action: Apply decay to memories (reduces salience over time)
export const decayMemories = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const memories = await ctx.runQuery(api.memories.queryMemories, {});

    const now = Date.now();
    let updated = 0;

    for (const memory of memories) {
      const daysSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60 * 24);

      if (daysSinceAccess > 1) {
        const newSalience = Math.max(
          0.1,
          memory.salience * (1 - memory.decayRate * daysSinceAccess)
        );

        if (newSalience < memory.salience) {
          await ctx.runMutation(api.memories.updateSalience, {
            memoryId: memory._id,
            salience: newSalience,
          });
          updated++;
        }
      }
    }

    return { success: true, updated };
  },
});

// Action: Extract memories from conversation using AI
export const extractMemories = action({
  args: {
    content: v.string(),
    save: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Sign-up approval gate: no model call for pending/revoked accounts.
    await requireApprovedForAi(ctx);

    const extractionPrompt = `Analyze this conversation and extract important facts, preferences, and information worth remembering about the user.

Return a JSON array of memories, each with:
- content: The fact or information to remember
- sector: One of "semantic" (facts/knowledge), "episodic" (events/experiences), "procedural" (how to do things), "emotional" (feelings/preferences), or "general"
- salience: Importance from 0.1 to 1.0

Only extract genuinely useful information. Return [] if nothing worth remembering.
Return ONLY valid JSON array, no markdown or explanation.

Conversation:
${args.content}`;

    // Same single model seam as every other Tempo AI call (convex/lib/ai_router.ts:
    // DeepInfra, TEMPO_AI_MODEL / DEEPINFRA_API_KEY).
    let extractedText: string;
    try {
      const result = await callLLM({
        tier: 'fast',
        messages: [{ role: 'user', content: extractionPrompt }],
        maxTokens: 1024,
        temperature: 0.2,
      });
      extractedText = result.content || '[]';
    } catch {
      throw new Error('AI extraction failed');
    }

    // Parse extracted memories
    let memories: Array<{
      content: string;
      sector: MemorySector;
      salience: number;
    }> = [];

    try {
      const cleanJson = extractedText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      memories = parsed.map((m: any) => ({
        content: m.content || '',
        sector: (m.sector || 'general') as MemorySector,
        salience: Math.max(0.1, Math.min(1.0, m.salience || 0.5)),
      }));
    } catch (e) {
      console.error('Failed to parse extracted memories:', e);
      return { success: false, data: [] };
    }

    // Optionally save extracted memories
    if (args.save && memories.length > 0) {
      for (const memory of memories) {
        await ctx.runMutation(api.memories.addMemory, {
          content: memory.content,
          sector: memory.sector,
          salience: memory.salience,
        });
      }
    }

    return { success: true, data: memories };
  },
});

// Query: Get memory statistics by sector
export const getMemoryStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const memories = await ctx.db
      .query('memories')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect();

    const sectors: MemorySector[] = ['semantic', 'episodic', 'procedural', 'emotional', 'general'];
    const stats = sectors.map((sector) => {
      const sectorMemories = memories.filter((m) => m.sector === sector);
      return {
        sector,
        count: sectorMemories.length,
        avgSalience: sectorMemories.length > 0
          ? sectorMemories.reduce((sum, m) => sum + m.salience, 0) / sectorMemories.length
          : 0,
      };
    });

    return {
      total: memories.length,
      sectors: stats,
      avgSalience: memories.length > 0
        ? memories.reduce((sum, m) => sum + m.salience, 0) / memories.length
        : 0,
    };
  },
});

