export type ListFilter = {
  field: string;
  op: "==" | "<" | "<=" | ">" | ">=";
  value: string | number | boolean;
};

export type ListRequest = {
  uid: string;
  collection: string;
  filters?: ListFilter[];
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  startAfter?: string | number;
};

export class FirestoreQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirestoreQueryError";
  }
}

type RestValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number };

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED_ID = /^__.*__$/;

function validateSegment(value: string, label: string): void {
  if (
    value.length === 0 ||
    value.includes("/") ||
    value === "." ||
    value === ".." ||
    RESERVED_ID.test(value)
  ) {
    throw new FirestoreQueryError(`Invalid ${label}`);
  }
}

function validateField(field: string): void {
  if (!FIELD_NAME.test(field)) {
    throw new FirestoreQueryError("Invalid field name");
  }
}

function encodeValue(value: string | number | boolean): RestValue {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (!Number.isFinite(value)) {
    throw new FirestoreQueryError("Numbers must be finite");
  }
  if (Number.isInteger(value)) return { integerValue: String(value) };
  return { doubleValue: value };
}

const OPERATOR = {
  "==": "EQUAL",
  "<": "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">": "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
} as const;

function fieldFilter(filter: ListFilter) {
  validateField(filter.field);
  return {
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: OPERATOR[filter.op],
      value: encodeValue(filter.value),
    },
  };
}

export function buildListQuery(request: ListRequest): {
  parent: string;
  body: { structuredQuery: Record<string, unknown> };
} {
  validateSegment(request.uid, "uid");
  validateSegment(request.collection, "collection");

  const filters = request.filters ?? [];
  if (filters.length > 5) {
    throw new FirestoreQueryError("At most 5 filters are allowed");
  }

  const limit = request.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new FirestoreQueryError("Limit must be an integer from 1 to 200");
  }

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: request.collection }],
    limit,
  };

  const encodedFilters = filters.map(fieldFilter);
  if (encodedFilters.length === 1) {
    structuredQuery.where = encodedFilters[0];
  } else if (encodedFilters.length > 1) {
    structuredQuery.where = {
      compositeFilter: { op: "AND", filters: encodedFilters },
    };
  }

  const rangeFields = filters.filter((filter) => filter.op !== "==").map((filter) => filter.field);
  if (request.orderBy) {
    validateField(request.orderBy.field);
    if (rangeFields.length > 0 && !rangeFields.includes(request.orderBy.field)) {
      throw new FirestoreQueryError("The range-filter field must be the orderBy field");
    }
    structuredQuery.orderBy = [
      {
        field: { fieldPath: request.orderBy.field },
        direction: request.orderBy.direction === "asc" ? "ASCENDING" : "DESCENDING",
      },
    ];
  }

  if (request.startAfter !== undefined) {
    if (!request.orderBy) {
      throw new FirestoreQueryError("startAfter requires orderBy");
    }
    structuredQuery.startAt = {
      values: [encodeValue(request.startAfter)],
      before: false,
    };
  }

  return { parent: `users/${request.uid}`, body: { structuredQuery } };
}
