import { createClient } from "@insforge/sdk";

type InsforgeEnv = {
  NEXT_PUBLIC_INSFORGE_URL?: string;
  NEXT_PUBLIC_INSFORGE_ANON_KEY?: string;
};

export function makeInsforgeClientGetter<Client>(
  env: InsforgeEnv,
  create: (options: { baseUrl: string; anonKey: string }) => Client
): () => Client | null {
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_INSFORGE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) return () => null;

  let client: Client | undefined;
  return () => {
    client ??= create({ baseUrl, anonKey });
    return client;
  };
}

const getInsforgeClient = makeInsforgeClientGetter(
  {
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
  createClient
);

export default getInsforgeClient;
