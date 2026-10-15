import { describe, expect, test } from "bun:test";
import { routeParam } from "./route-param";

describe("routeParam", () => {
  test("decodes what a link encoded, so a starter template id reaches the query as stored", () => {
    expect(routeParam(encodeURIComponent("starter:daily-page"))).toBe("starter:daily-page");
    expect(routeParam("starter%3Adaily-page")).toBe("starter:daily-page");
    expect(routeParam(encodeURIComponent("שבועי חדש"))).toBe("שבועי חדש");
  });

  test("leaves a plain id alone, and never throws on bad encoding", () => {
    expect(routeParam("jd72usertemplate01")).toBe("jd72usertemplate01");
    expect(routeParam("starter:daily-page")).toBe("starter:daily-page");
    expect(routeParam("100%")).toBe("100%");
  });
});
