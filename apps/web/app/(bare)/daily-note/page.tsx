/**
 * @screen: daily-note
 * @summary: Today's daily page already lives on /today (components/today/DailyPage.tsx: the
 *   Markdown page for the local date, made from the Daily template on first open). Only the
 *   browser knows the local date, so this route sends people to /today rather than drawing a
 *   second daily screen. The query string goes along, so `?lang=he` still picks the language.
 * @auth: required (signed-out visitors are sent to sign-in first)
 */
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const one of values) query.append(key, one);
  }
  const search = query.toString();
  redirect(search ? `/today?${search}` : "/today");
}
