import { handleSearch } from "@/lib/server/search-service";

export const runtime = "nodejs";
export const maxDuration = 15;

export function POST(request: Request): Promise<Response> {
  return handleSearch(request);
}
