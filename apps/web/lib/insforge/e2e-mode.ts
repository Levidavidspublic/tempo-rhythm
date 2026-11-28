export function isInsforgeE2eMode(): boolean {
  return (
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1"
  );
}
