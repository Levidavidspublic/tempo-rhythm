// Gallery stand-in for "convex/react": hooks answer from window.__gallery (set by entry.tsx), so the
// real components render with sample data and no backend. Not used by the app.
//
// `mode` (set per view by entry.tsx) shows the states a backend would put a screen in; without it
// every hook answers exactly as before:
//   loading    every query answers undefined (still loading), so useSignedIn says "loading" too
//   signedOut  useConvexAuth says signed out and users.getProfile answers null
//   error      every query throws, so the screen's own error boundary shows
//   offline    entry.tsx makes navigator.onLine false; writes never settle, as Convex holds them
//              until the connection is back
type Fixture = unknown | ((args: unknown) => unknown);
export type GalleryMode = "loading" | "signedOut" | "error" | "offline";
type Gallery = { queries: Record<string, Fixture>; calls: Record<string, Fixture>; mode?: GalleryMode };

function gallery(): Gallery {
  return (window as unknown as { __gallery: Gallery }).__gallery;
}

function answer(map: Record<string, Fixture>, name: string, args: unknown): unknown {
  const value = map[name];
  return typeof value === "function" ? (value as (a: unknown) => unknown)(args) : value;
}

export function useConvexAuth() {
  return { isAuthenticated: gallery().mode !== "signedOut", isLoading: false };
}

function read(name: string, args: unknown): unknown {
  const mode = gallery().mode;
  if (mode === "loading") return undefined;
  if (mode === "error") throw new Error(`Gallery error mode: ${name}`);
  if (mode === "signedOut" && name === "users.getProfile") return null;
  return answer(gallery().queries, name, args);
}

export function useQuery(ref: unknown, args?: unknown) {
  if (args === "skip") return undefined;
  return read(String(ref), args);
}

function call(ref: unknown) {
  const fn = async (args: unknown) => {
    if (gallery().mode === "offline") return new Promise(() => {});
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
    query: async (ref: unknown, args: unknown) => read(String(ref), args),
    mutation: (ref: unknown, args: unknown) => call(ref)(args),
    action: (ref: unknown, args: unknown) => call(ref)(args),
  };
}

export function ConvexProvider({ children }: { children: unknown }) {
  return children;
}
