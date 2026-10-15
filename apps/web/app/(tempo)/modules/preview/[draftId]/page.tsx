/**
 * @screen: module-preview
 * @category: You
 * @source: docs/design/v3/screens/web/module-preview.html
 * @summary: A coach-made module waiting for approval. No drafts exist yet, so it says so.
 * @queries: (none yet)
 * @mutations: (none)
 * @auth: required
 */
import { ModulePreviewScreen } from "@/components/modules/ModulePreviewScreen";

export default function Page() {
  return <ModulePreviewScreen />;
}
