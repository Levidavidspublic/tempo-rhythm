export const DOC_ID_LENGTH = 20;

const DOC_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const UNBIASED_BYTE_LIMIT = 248;
const validDocIdPattern = /^(?!__.*__$)[A-Za-z0-9_-]{1,128}$/;

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function newDocId(
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes
): string {
  let id = "";

  while (id.length < DOC_ID_LENGTH) {
    const bytes = randomBytes(DOC_ID_LENGTH - id.length);

    for (const byte of bytes) {
      if (byte < UNBIASED_BYTE_LIMIT) {
        id += DOC_ID_ALPHABET[byte % DOC_ID_ALPHABET.length];
        if (id.length === DOC_ID_LENGTH) break;
      }
    }
  }

  return id;
}

export function isDocId(value: unknown): value is string {
  return typeof value === "string" && validDocIdPattern.test(value);
}
