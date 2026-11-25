import { createClient } from "@insforge/sdk";

type InsforgeEnv = {
  url?: string;
  anonKey?: string;
};

export function makeInsforgeClientGetter<Client>(
  env: InsforgeEnv,
  create: (options: { baseUrl: string; anonKey: string }) => Client
): () => Client | null {
  const baseUrl = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!baseUrl || !anonKey) return () => null;

  let client: Client | undefined;
  return () => {
    client ??= create({ baseUrl, anonKey });
    return client;
  };
}

const getInsforgeClient = makeInsforgeClientGetter(
  {
    url: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
  createClient
);

export default getInsforgeClient;
