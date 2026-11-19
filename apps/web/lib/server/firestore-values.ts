export type RestValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values?: RestValue[] } }
  | { mapValue: { fields?: Record<string, RestValue> } };

export type RestFields = Record<string, RestValue>;

export type PlainValue =
  | string
  | number
  | boolean
  | null
  | PlainValue[]
  | { [key: string]: PlainValue };

export class FirestoreValueError extends Error {
  constructor(path: string) {
    super(`Unsupported Firestore value at ${path}`);
    this.name = "FirestoreValueError";
  }
}

function propertyPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encodeValue(
  value: unknown,
  path: string,
  insideArray = false,
): RestValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new FirestoreValueError(path);
    if (Number.isSafeInteger(value)) return { integerValue: value.toString() };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    if (insideArray) throw new FirestoreValueError(path);
    return {
      arrayValue: {
        values: value.map((item, index) => {
          const itemPath = `${path}[${index}]`;
          if (item === undefined) throw new FirestoreValueError(itemPath);
          return encodeValue(item, itemPath, true);
        }),
      },
    };
  }

  if (typeof value === "object" && isPlainObject(value)) {
    const fields: RestFields = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined)
        fields[key] = encodeValue(item, propertyPath(path, key));
    }
    return { mapValue: { fields } };
  }

  throw new FirestoreValueError(path);
}

export function encodeFields(input: Record<string, unknown>): RestFields {
  const fields: RestFields = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) fields[key] = encodeValue(value, key);
  }
  return fields;
}

function decodeValue(value: RestValue, path: string): PlainValue {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;

  if ("integerValue" in value) {
    const decoded = Number(value.integerValue);
    if (
      !Number.isSafeInteger(decoded) ||
      decoded.toString() !== value.integerValue
    ) {
      throw new FirestoreValueError(path);
    }
    return decoded;
  }

  if ("doubleValue" in value) {
    if (!Number.isFinite(value.doubleValue))
      throw new FirestoreValueError(path);
    return value.doubleValue;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item, index) =>
      decodeValue(item, `${path}[${index}]`),
    );
  }

  if ("mapValue" in value) {
    return decodeFieldsAtPath(value.mapValue.fields, path);
  }

  throw new FirestoreValueError(path);
}

function decodeFieldsAtPath(
  fields: RestFields | undefined,
  parentPath: string,
): Record<string, PlainValue> {
  const decoded: Record<string, PlainValue> = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    decoded[key] = decodeValue(value, propertyPath(parentPath, key));
  }
  return decoded;
}

export function decodeFields(
  fields: RestFields | undefined,
): Record<string, PlainValue> {
  return decodeFieldsAtPath(fields, "");
}
