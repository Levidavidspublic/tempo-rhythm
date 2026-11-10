/**
 * A dynamic route segment as the value it encodes. Links build these segments with
 * `encodeURIComponent` (a starter template's id is "starter:daily-page"), and Next hands the page
 * the segment still percent-encoded ("starter%3Adaily-page"), so it must be decoded once here.
 * A segment that is not valid percent-encoding is returned as it came.
 */
export function routeParam(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
