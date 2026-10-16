import { Suspense } from "react";
import { NotesList } from "@/components/notes-pages/NotesList";
import { StateLoading } from "@/components/you/ScreenStates";

/** The list reads the URL's filters, so it waits in Suspense; the fallback is the shared skeleton. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="tp-page" data-component="PageLayout">
          <StateLoading label="Loading your notes." rows={4} box={false} />
        </div>
      }
    >
      <NotesList />
    </Suspense>
  );
}
