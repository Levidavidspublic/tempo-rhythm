import { Suspense } from "react";
import { NotesList } from "@/components/notes-pages/NotesList";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-muted-foreground">Loading your notes.</p>}>
      <NotesList />
    </Suspense>
  );
}
