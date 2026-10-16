/**
 * @screen: study-listen (S16 AudioRecapPlayer)
 * @source: docs/kitchen/RUN-LOG.md (backlog: S16 on the browser's own speech engine)
 * @queries: users.getProfile, notes.getSafe (?from=<noteId>)
 * @mutations: none (the recap and "Ask a question" run on the device)
 * @auth: required
 */
import { ListenScreen } from "@/components/study/recap/ListenScreen";
import { parseMode } from "@/components/study/recap/player";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { from, mode } = await searchParams;
  return (
    <ListenScreen from={typeof from === "string" && from !== "" ? from : undefined} mode={parseMode(mode)} />
  );
}
