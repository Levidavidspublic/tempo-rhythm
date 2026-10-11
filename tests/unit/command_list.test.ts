import { describe, expect, test } from "bun:test";
import { REAL_SCREENS } from "../../apps/web/components/tempo/CommandList";

describe("REAL_SCREENS", () => {
  test("includes implemented routes while excluding scaffold routes", () => {
    const routes = REAL_SCREENS.map((screen) => screen.route);

    expect(routes).toContain("/activity");
    expect(routes).toContain("/settings/integrations");
    expect(routes).not.toContain("/journal");
  });
});
