import { ProfileReady } from "@/components/today/ProfileReady";
import { TemplatesLibrary } from "@/components/templates-library/TemplatesLibrary";

export default function Page() {
  return (
    <div data-testid="templates-library-route">
      <ProfileReady>
        <TemplatesLibrary />
      </ProfileReady>
    </div>
  );
}
