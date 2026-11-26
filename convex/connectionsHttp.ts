import { httpAction } from "./_generated/server";
import { defaultConnectionDeps, handleExecutorCallback } from "./connections";

/**
 * `GET /connections/executor/callback` (TEMPO-B07-07, #989; research doc §2.4, §5.2): where
 * Executor sends the browser back after the person approves or declines. The checks, the code
 * exchange and the encrypted save are `connections.handleExecutorCallback`. The answer is always
 * a redirect to a fixed page on `SITE_URL` with `?executor=connected|denied|expired|error`, with
 * `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; tokens never reach the browser.
 */
export const executorCallback = httpAction(async (ctx, request) =>
  handleExecutorCallback(ctx, request, defaultConnectionDeps()),
);
