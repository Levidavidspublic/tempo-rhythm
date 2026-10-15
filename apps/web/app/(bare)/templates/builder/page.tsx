import { TemplateBuilderScreen } from "@/components/template-builder/TemplateBuilder";
import { ProfileReady } from "@/components/today/ProfileReady";

type SearchParams = { from?: string | string[]; id?: string | string[]; outline?: string | string[] };

function first(value: string | string[] | undefined): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return one || undefined;
}

/** Template builder (docs/design/v3/screens/web/template-builder.html). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <div data-testid="template-builder-route">
      <ProfileReady>
        <TemplateBuilderScreen fromId={first(params.from)} editId={first(params.id)} outline={first(params.outline)} />
      </ProfileReady>
    </div>
  );
}
