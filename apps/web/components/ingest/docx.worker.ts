/**
 * The Word reader's own worker (IngestSheet, read-sources.ts → readDocxInWorker). mammoth runs
 * here, off the page's thread, so a file that unpacks to far more than it declared can't freeze
 * the tab: the sheet terminates this worker on Stop, on close and after DOCX_READ_TIMEOUT_MS.
 *
 * RAM-ONLY (HARD_RULES §6.4): it gets the file's bytes in a message, sends back the text and
 * keeps nothing; the worker is ended after each file.
 */

type DocxWorkerScope = {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage(message: { ok: true; text: string } | { ok: false }): void;
};

const scope = self as unknown as DocxWorkerScope;

scope.onmessage = (event) => {
  void (async () => {
    try {
      const mod = await import("mammoth");
      // mammoth is CommonJS: the bundler may put its exports on `default`.
      const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const result = await mammoth.extractRawText({ arrayBuffer: event.data });
      scope.postMessage({ ok: true, text: result.value });
    } catch {
      scope.postMessage({ ok: false });
    }
  })();
};
