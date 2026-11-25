import { randomBytes, randomUUID } from "node:crypto";

export const newId = () => randomUUID();

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 7-char base62 short code (~3.5 trillion combinations), using rejection sampling to avoid modulo bias. */
export function newShortCode(length = 7): string {
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248 && out.length < length) out += ALPHABET[b % 62]; // 248 = 62 * 4
    }
  }
  return out;
}

export const SHORT_CODE_RE = /^[0-9A-Za-z]{4,12}$/;
