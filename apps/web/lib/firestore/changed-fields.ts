export type ChangedFields = {
  set: Record<string, unknown>;
  removed: string[];
  names: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateValue(value: unknown, ancestors: WeakSet<object>): void {
  const valueType = typeof value;
  if (valueType === "function" || valueType === "symbol") {
    throw new TypeError("Firestore document values cannot contain functions or symbols");
  }
  if (valueType === "number" && Number.isNaN(value)) {
    throw new TypeError("Firestore document values cannot contain NaN");
  }
  if (value === null || valueType !== "object") return;
  const objectValue = value as object;

  if (ancestors.has(objectValue)) {
    throw new TypeError("Firestore document values cannot contain cycles");
  }
  ancestors.add(objectValue);

  if (Array.isArray(value)) {
    for (const item of value) validateValue(item, ancestors);
  } else {
    if (!isPlainObject(value)) {
      throw new TypeError("Firestore document values must use plain objects");
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") {
        throw new TypeError("Firestore document values cannot contain symbol keys");
      }
      validateValue(value[key], ancestors);
    }
  }

  ancestors.delete(objectValue);
}

function validateDocument(value: unknown): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new TypeError("Firestore documents must be plain objects");
  }
  validateValue(value, new WeakSet<object>());
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => valuesEqual(item, right[index]));
  }

  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key]));
}

export function findChangedFields(before: unknown, after: unknown): ChangedFields {
  validateDocument(before);
  validateDocument(after);

  const set: Record<string, unknown> = {};
  const removed: string[] = [];
  const fieldNames = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const name of fieldNames) {
    const existedBefore = Object.hasOwn(before, name);
    const existsAfter = Object.hasOwn(after, name);
    const nextValue = after[name];

    if (existedBefore && (!existsAfter || nextValue === undefined)) {
      removed.push(name);
    } else if (
      existsAfter &&
      nextValue !== undefined &&
      (!existedBefore || !valuesEqual(before[name], nextValue))
    ) {
      Object.defineProperty(set, name, {
        configurable: true,
        enumerable: true,
        value: nextValue,
        writable: true,
      });
    }
  }

  removed.sort();
  return { set, removed, names: [...Object.keys(set), ...removed].sort() };
}
