import { TemplateEditorScreen } from "@/components/template-builder/TemplateEditor";
import { ProfileReady } from "@/components/today/ProfileReady";
import { routeParam } from "@/lib/route-param";

type Params = { id: string };

/** Template editor, the plain form view (docs/design/v3/screens/web/template-editor.html). */
export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const id = routeParam((await params).id);
  return (
    <div data-testid="template-editor-route">
      <ProfileReady>
        <TemplateEditorScreen templateId={id} />
      </ProfileReady>
    </div>
  );
}
