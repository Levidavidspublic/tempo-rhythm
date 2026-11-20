/**
 * The screens the command bar jumps to. The list lives with the command bar's model
 * (lib/command-palette.ts); the /command page renders CommandPanel from ./CommandPalette.
 * Kept as a light module (no React, no Convex) for callers that only need the list.
 */
export { REAL_SCREENS } from "@/lib/command-palette";
