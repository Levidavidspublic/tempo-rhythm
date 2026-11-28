export type DataBackend = "convex" | "firebase" | "insforge";

export function parseDataBackend(raw: string | undefined): DataBackend {
  const backend = raw?.trim();
  return backend === "firebase" || backend === "insforge" ? backend : "convex";
}

export const DATA_BACKEND = parseDataBackend(process.env.NEXT_PUBLIC_DATA_BACKEND);
