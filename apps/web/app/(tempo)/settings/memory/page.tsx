/**
 * @screen: settings-memory
 * @category: Settings
 * @source: docs/design/v3/screens/web/memory.html
 * @summary: See and manage what Tempo remembers.
 * @auth: required
 */
import { MemoryManager } from "@/components/memory/MemoryManager";

export default function Page() {
  return <MemoryManager />;
}
