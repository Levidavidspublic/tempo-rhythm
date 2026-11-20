/**
 * @screen: memory-import
 * @category: Settings
 * @source: docs/design/v3/screens/web/memory-import.html
 * @summary: Bring memories over from ChatGPT or Claude; review every item before saving.
 * @mutations: memoryImport.saveReviewed, memory.forgetAll (Undo)
 * @auth: required
 */
import { MemoryImportScreen } from "@/components/memory/MemoryImportScreen";

export default function Page() {
  return <MemoryImportScreen />;
}
