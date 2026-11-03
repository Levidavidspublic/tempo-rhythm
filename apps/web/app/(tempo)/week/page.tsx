import { WeekOpener } from "@/components/today/WeekOpener";

/** /week: this week's page for the viewer's local date (the server can't know the time zone). */
export default function Page() {
  return <WeekOpener weekKey={null} />;
}
