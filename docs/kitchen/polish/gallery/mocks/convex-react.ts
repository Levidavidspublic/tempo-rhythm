// Gallery stand-in for "convex/react": hooks answer from window.__gallery (set by entry.tsx), so the
// real components render with sample data and no backend. Not used by the app.
type Fixture = unknown | ((args: unknown) => unknown);
type Gallery = { queries: Record<string, Fixture>; calls: Record<string, Fixture> };

function gallery(): Gallery {
  return (window as unknown as { __gallery: Gallery }).__gallery;
}

function answer(map: Record<string, Fixture>, name: string, args: unknown): unknown {
  const value = map[name];
  return typeof value === "function" ? (value as (a: unknown) => unknown)(args) : value;
}

export function useConvexAuth() {
  return { isAuthenticated: true, isLoading: false };
}

export function useQuery(ref: unknown, args?: unknown) {
  if (args === "skip") return undefined;
  return answer(gallery().queries, String(ref), args);
}

function call(ref: unknown) {
  const fn = async (args: unknown) => {
    const value = answer(gallery().calls, String(ref), args);
    if (value instanceof Error) throw value;
    return value ?? null;
  };
  (fn as unknown as { withOptimisticUpdate: () => typeof fn }).withOptimisticUpdate = () => fn;
  return fn;
}

export const useMutation = call;
export const useAction = call;

export function useConvex() {
  return {
    query: async (ref: unknown, args: unknown) => answer(gallery().queries, String(ref), args),
    mutation: (ref: unknown, args: unknown) => call(ref)(args),
    action: (ref: unknown, args: unknown) => call(ref)(args),
  };
}

export function ConvexProvider({ children }: { children: unknown }) {
  return children;
}
