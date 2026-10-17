/**
 * @screen: study (S19 ReviewHub)
 * @source: docs/kitchen/study/T3-SPEC.md (Builder D)
 * @queries: users.getProfile, study.hub
 * @mutations: none here (IngestSheet saves a page through its own flow)
 * @auth: required
 */
import { ReviewHub } from "@/components/study/ReviewHub";

export default function Page() {
  return <ReviewHub />;
}
