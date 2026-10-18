// Gallery stand-in for "@/convex/_generated/api": api.messages.list is the string "messages.list".
const mod = (name: string) => new Proxy({}, { get: (_target, fn) => `${name}.${String(fn)}` });
export const api = new Proxy({}, { get: (_target, name) => mod(String(name)) }) as Record<string, Record<string, string>>;
export const internal = api;
