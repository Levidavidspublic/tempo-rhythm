import { ProfileReady } from "@/components/today/ProfileReady";
import { TemplateRun } from "@/components/template-run/TemplateRun";
import { routeParam } from "@/lib/route-param";

type Params = { id: string };

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const id = routeParam((await params).id);
  return (
    <div data-testid="template-run-route">
      <ProfileReady>
        <TemplateRun templateId={id} />
      </ProfileReady>
    </div>
  );
}
