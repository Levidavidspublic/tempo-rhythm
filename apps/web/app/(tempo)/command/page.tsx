/**
 * @screen: command
 * @category: You
 * @summary: Filter and open the available Tempo screens.
 * @queries: (none)
 * @mutations: (none)
 * @auth: required
 */
import { CommandList } from "@/components/tempo/CommandList";

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-8">
      <header className="space-y-3">
        <p className="font-eyebrow text-primary">Jump to</p>
        <h1 className="font-heading text-4xl font-semibold text-foreground">Command</h1>
        <p className="max-w-2xl text-body leading-relaxed text-muted-foreground">
          Find a screen by name, then press Enter to open it. Use the arrow keys to move through the list.
        </p>
      </header>

      <CommandList />
    </main>
  );
}
