/**
 * Compatibility re-export. The page-block codec lives in `@tempo/utils` (browser-safe, shared by
 * the backend and the UI); this module keeps the original Convex import path working and must not
 * contain a second schema or parser.
 */
export {
  BLOCK_CODEC_LIMITS,
  type BlockErrorCode,
  type BlockSegment,
  type BrokenBlockSegment,
  type MarkdownSegment,
  pageMetaDataSchema,
  parseTempoBlocks,
  serializeTempoBlocks,
  type TempoBlock,
  taskDataSchema,
  tempoBlockSchema,
  templateDataSchema,
  type ValidBlockSegment,
} from "@tempo/utils";
