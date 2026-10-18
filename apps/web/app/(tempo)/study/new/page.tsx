/**
 * @screen: study-new (S25 Turn into preview)
 * @source: docs/kitchen/study/T3-SPEC.md (Builder D)
 * @queries: users.getProfile, notes.getSafe
 * @actions: study.generate ("Ask the coach"; never saves)
 * @mutations: study.createFromPreview (on Accept only), study.undoCreate (5-minute Undo),
 *   study.registerBlock (?from=<noteId>&block=<blockId>: open a study block already in a page)
 * @auth: required
 */
import { TurnIntoPreview } from "@/components/study/TurnIntoPreview";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <TurnIntoPreview from={one(params.from)} kind={one(params.kind)} block={one(params.block)} />;
}
