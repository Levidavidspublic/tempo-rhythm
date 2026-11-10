/**
 * @screen: template-sketch
 * @source: docs/design/v3/screens/web/template-sketch.html
 * @summary: A rough outline becomes a template proposal; nothing is saved until Accept.
 * @mutations: templates.create (Accept), templates.remove (Undo)
 * @auth: required
 */
import { TemplateSketch } from "@/components/template-builder/TemplateSketch";
import { ProfileReady } from "@/components/today/ProfileReady";

export default function Page() {
  return (
    <div data-testid="template-sketch-route">
      <ProfileReady>
        <TemplateSketch />
      </ProfileReady>
    </div>
  );
}
