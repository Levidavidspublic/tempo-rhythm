import { WeekOpener } from "@/components/today/WeekOpener";

/** /week/2026-W42: opens (or makes) that week's Markdown page, then shows it at /notes/[id]. */
export default async function Page({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  // Next already decodes dynamic params; decoding again could throw on "%".
  return <WeekOpener weekKey={week} />;
}
