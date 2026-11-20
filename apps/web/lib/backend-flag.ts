export type DataBackend = "convex" | "firebase";

export function parseDataBackend(raw: string | undefined): DataBackend {
  return raw?.trim() === "firebase" ? "firebase" : "convex";
}

export const DATA_BACKEND = parseDataBackend(process.env.NEXT_PUBLIC_DATA_BACKEND);
