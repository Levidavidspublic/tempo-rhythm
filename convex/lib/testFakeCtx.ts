type Row = Record<string, unknown>;

/** Minimal in-memory Convex ctx for handler tests; same idea as the fake ctx in `convex/dayPlans.test.ts`. */
export function makeFakeCtx(userId: string, extraUsers: string[] = []) {
	const tables = new Map<string, Map<string, Row>>();
	let nextId = 1;
	const table = (name: string) => {
		let t = tables.get(name);
		if (!t) {
			t = new Map();
			tables.set(name, t);
		}
		return t;
	};
	for (const id of [userId, ...extraUsers]) {
		table("users").set(id, { _id: id, email: `${id}@example.com` });
	}

	const rank = (x: unknown) => (x === undefined ? -Infinity : (x as number | string));
	function builder(rows: Row[], sortField?: string, desc = false) {
		return {
			withIndex: (_name: string, fn: (q: any) => unknown) => {
				const conds: { op: string; field: string; value: unknown }[] = [];
				const q: any = {};
				for (const op of ["eq", "gte", "lt"]) {
					q[op] = (field: string, value: unknown) => {
						conds.push({ op, field, value });
						return q;
					};
				}
				fn(q);
				const ok = (r: Row) =>
					conds.every((c) =>
						c.op === "eq"
							? r[c.field] === c.value
							: c.op === "gte"
								? rank(r[c.field]) >= rank(c.value)
								: rank(r[c.field]) < rank(c.value),
					);
				return builder(rows.filter(ok), conds.find((c) => c.op !== "eq")?.field);
			},
			order: (dir: "asc" | "desc") => builder(rows, sortField, dir === "desc"),
			collect: async () => {
				const out = [...rows];
				if (sortField) {
					out.sort((a, b) => (rank(a[sortField]) as number) - (rank(b[sortField]) as number));
					if (desc) out.reverse();
				}
				return out;
			},
		};
	}

	const db = {
		normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
		get: async (id: string) => table(id.split(":")[0]).get(id) ?? null,
		insert: async (t: string, doc: Row) => {
			const id = `${t}:${nextId++}`;
			table(t).set(id, { _id: id, _creationTime: 0, ...doc });
			return id;
		},
		patch: async (id: string, patch: Row) => {
			const t = table(id.split(":")[0]);
			t.set(id, { ...t.get(id), ...patch });
		},
		query: (t: string) => builder(Array.from(table(t).values())),
	};
	return { auth: { getUserIdentity: async () => ({ subject: userId }) }, db } as any;
}

export const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as any)._handler(ctx, args);
