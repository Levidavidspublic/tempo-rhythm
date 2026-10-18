/**
 * Ids for study blocks and their items, kitchen T3.
 *
 * Pure functions: the caller passes `now` (Unix ms) and a `random` function returning a number in
 * [0, 1), so tests can pin both.
 *
 * - A block id is `blk_` + a ULID: 10 Crockford base-32 characters of time (48 bits, so the first
 *   character is 0–7) and 16 characters of randomness. It matches the page codec's grammar,
 *   `/^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/`, and sorts by creation time.
 * - Item ids (cards, questions, choices, parts) are a short prefix plus a 1-based counter, which
 *   always fits the codec's `^[A-Za-z0-9_-]{1,32}$`.
 */

export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const BLOCK_ID_PATTERN = /^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

const MAX_ULID_TIME = 2 ** 48 - 1;
const TIME_CHARS = 10;
const RANDOM_CHARS = 16;

/** The 10-character time part of a ULID. Throws for a time outside 0..2^48-1. */
export function encodeUlidTime(now: number): string {
  if (!Number.isInteger(now) || now < 0 || now > MAX_ULID_TIME) {
    throw new RangeError("now must be an integer Unix ms time from 0 to 2^48 - 1");
  }
  let rest = now;
  let out = "";
  for (let i = 0; i < TIME_CHARS; i++) {
    out = CROCKFORD_ALPHABET[rest % 32] + out;
    rest = Math.floor(rest / 32);
  }
  return out;
}

/** One Crockford character from a `random()` draw; out-of-range draws are clamped. */
function randomChar(random: () => number): string {
  const draw = random();
  const safe = Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 0.999999999) : 0;
  return CROCKFORD_ALPHABET[Math.floor(safe * 32)] as string;
}

/** A 26-character ULID for `now`, its randomness drawn from `random`. */
export function newUlid(now: number, random: () => number): string {
  let out = encodeUlidTime(now);
  for (let i = 0; i < RANDOM_CHARS; i++) out += randomChar(random);
  return out;
}

/** A page-codec block id: `blk_` + a ULID. */
export function newBlockId(now: number, random: () => number): string {
  return `blk_${newUlid(now, random)}`;
}

export function isBlockId(value: unknown): value is string {
  return typeof value === "string" && BLOCK_ID_PATTERN.test(value);
}

/**
 * `n` item ids: `prefix1`, `prefix2`, … Throws when the prefix is not id-safe or the ids would
 * be longer than 32 characters.
 */
export function itemIds(prefix: string, n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n must be a whole number");
  if (prefix !== "" && !ITEM_ID_PATTERN.test(prefix)) {
    throw new RangeError("prefix may use only letters, digits, _ and -");
  }
  if (prefix.length + String(Math.max(n, 1)).length > 32) {
    throw new RangeError("item ids would be longer than 32 characters");
  }
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}
