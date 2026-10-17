/**
 * @screen: study-review (S19 review session)
 * @source: docs/kitchen/study/T3-SPEC.md (Builder D)
 * @queries: users.getProfile, study.reviewQueue (everything due, or ?set=<id>)
 * @mutations: study.review, study.undoReview (5-minute Undo)
 * @auth: required
 */
import { ReviewSession } from "@/components/study/ReviewSession";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { set } = await searchParams;
  return <ReviewSession setId={typeof set === "string" && set !== "" ? set : undefined} />;
}
