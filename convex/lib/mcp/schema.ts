/**
 * Tiny JSON Schema validator for the subset the Tempo MCP tools use:
 * type (string | number | integer | boolean | object, or an array of those plus "null"),
 * enum, required, properties, additionalProperties: false, minLength, maxLength, minimum, maximum.
 */
export type JsonSchema = {
	type?: string | string[];
	description?: string;
	enum?: readonly (string | number | boolean)[];
	properties?: Record<string, JsonSchema>;
	required?: readonly string[];
	additionalProperties?: boolean;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
};

function typeMatches(type: string, value: unknown): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "boolean":
			return typeof value === "boolean";
		case "null":
			return value === null;
		case "object":
			return (
				typeof value === "object" && value !== null && !Array.isArray(value)
			);
		default:
			return false;
	}
}

/** Returns a list of problems; empty means valid. */
export function validateAgainstSchema(
	schema: JsonSchema,
	value: unknown,
	path = "arguments",
): string[] {
	const errors: string[] = [];
	if (schema.type !== undefined) {
		const types = Array.isArray(schema.type) ? schema.type : [schema.type];
		if (!types.some((t) => typeMatches(t, value))) {
			return [`${path} must be ${types.join(" or ")}`];
		}
	}
	if (value === null || value === undefined) {
		return errors;
	}
	if (
		schema.enum &&
		!schema.enum.includes(value as string | number | boolean)
	) {
		errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
	}
	if (typeof value === "string") {
		if (schema.minLength !== undefined && value.length < schema.minLength) {
			errors.push(`${path} must be at least ${schema.minLength} characters`);
		}
		if (schema.maxLength !== undefined && value.length > schema.maxLength) {
			errors.push(`${path} must be at most ${schema.maxLength} characters`);
		}
	}
	if (typeof value === "number") {
		if (schema.minimum !== undefined && value < schema.minimum) {
			errors.push(`${path} must be >= ${schema.minimum}`);
		}
		if (schema.maximum !== undefined && value > schema.maximum) {
			errors.push(`${path} must be <= ${schema.maximum}`);
		}
	}
	if (typeof value === "object" && !Array.isArray(value) && schema.properties) {
		const obj = value as Record<string, unknown>;
		for (const key of schema.required ?? []) {
			if (obj[key] === undefined) {
				errors.push(`${path}.${key} is required`);
			}
		}
		for (const [key, v] of Object.entries(obj)) {
			const sub = schema.properties[key];
			if (!sub) {
				if (schema.additionalProperties === false) {
					errors.push(`${path}.${key} is not allowed`);
				}
				continue;
			}
			if (v !== undefined) {
				errors.push(...validateAgainstSchema(sub, v, `${path}.${key}`));
			}
		}
	}
	return errors;
}
