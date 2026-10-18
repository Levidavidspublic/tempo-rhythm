// Stand-in for tesseract.js, pdf.js and mammoth in the gallery build (build.ts). The gallery is one
// IIFE, so Bun would inline the IngestSheet's `import()` of each library (megabytes of code the
// gallery never runs: its ingest views pass their own readers). Reaching this module is a bug.
const missing = () => {
  throw new Error("The gallery has no OCR, PDF or Word reader: pass `readers` to IngestSheetView.");
};
export const createWorker = missing;
export const OEM = { LSTM_ONLY: 1 };
export const getDocument = missing;
export const PDFWorker = { create: missing };
export const extractRawText = missing;
export default { createWorker, OEM, getDocument, PDFWorker, extractRawText };
