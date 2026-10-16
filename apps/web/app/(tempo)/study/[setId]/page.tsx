/**
 * @screen: study-set (S18 deck, S20 quiz, S21 practice test, S22 score)
 * @source: docs/kitchen/study/T3-SPEC.md (Builder D)
 * @queries: users.getProfile, study.getSet
 * @mutations: study.recordAttempt, study.removeSet, study.restoreSet (5-minute Undo),
 *   study.updateBlock, study.undoUpdate (Edit, 5-minute Undo)
 * @auth: required
 */
import { StudySetScreen } from "@/components/study/StudySetScreen";

type Params = { setId: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  const { setId } = await params;
  return <StudySetScreen setId={setId} />;
}
