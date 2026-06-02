// ─── HMAC-signed boss-damage receipt tokens (verify side) ───
// Minted by the PartyKit fly server (party/bossToken.ts), carried by the
// player's client to /api/events/credit-damage. Verified here with the
// shared FORCE_PUSH_HMAC_SECRET before crediting the live event.
//
// Format: `v1.<payload-base64url>.<sig-base64url>`

import { createHmac, timingSafeEqual } from "node:crypto";

export interface BossDamagePayload {
  /** Developer github_login (lowercased). */
  dln: string;
  /** Damage amount in this chunk. */
  amt: number;
  /** Minions killed in this chunk. */
  min: number;
  /** Expiration (epoch ms). */
  exp: number;
  /** Server-generated nonce; ensures token uniqueness (idempotency). */
  nonce: string;
}

const TOKEN_VERSION = "v1";
const MAX_TOKEN_LENGTH = 1024;

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

function getSecret(): string {
  const s = process.env.FORCE_PUSH_HMAC_SECRET;
  if (!s || s.length < 32) {
    throw new Error("FORCE_PUSH_HMAC_SECRET is missing or shorter than 32 chars");
  }
  return s;
}

export type BossDamageVerifyResult =
  | { ok: true; payload: BossDamagePayload }
  | { ok: false; reason: "invalid_format" | "bad_signature" | "expired" | "too_long" | "invalid_payload" };

export function verifyBossDamageToken(token: string): BossDamageVerifyResult {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "invalid_format" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "too_long" };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: "invalid_format" };

  const [, payloadB64, sigB64] = parts;
  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getSecret()).update(`${TOKEN_VERSION}.${payloadB64}`).digest();
    providedSig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "invalid_format" };
  }
  if (expectedSig.length !== providedSig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(expectedSig, providedSig)) return { ok: false, reason: "bad_signature" };

  let payload: BossDamagePayload;
  try {
    const json = base64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (
    !payload ||
    typeof payload.dln !== "string" ||
    typeof payload.amt !== "number" ||
    typeof payload.min !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string"
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (payload.exp < Date.now()) return { ok: false, reason: "expired" };
  if (payload.dln.length < 1 || payload.dln.length > 64) return { ok: false, reason: "invalid_payload" };
  if (!Number.isFinite(payload.amt) || payload.amt <= 0 || payload.amt > 100000) return { ok: false, reason: "invalid_payload" };
  if (!Number.isFinite(payload.min) || payload.min < 0 || payload.min > 100000) return { ok: false, reason: "invalid_payload" };
  if (payload.nonce.length < 8 || payload.nonce.length > 64) return { ok: false, reason: "invalid_payload" };

  return { ok: true, payload };
}
