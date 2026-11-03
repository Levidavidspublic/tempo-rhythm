import { redirect } from "next/navigation";

/** One page route (OVERNIGHT-RUN.md decision 6): /p/[pageId] is only an alias of /notes/[id]. */
export default async function Page({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  redirect(`/notes/${encodeURIComponent(pageId)}`);
}
