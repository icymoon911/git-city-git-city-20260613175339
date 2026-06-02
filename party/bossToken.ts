// HMAC-signed boss-damage receipt tokens (PartyKit/Worker side).
// Mirrors src/lib/bossEventToken.ts. The PartyKit fly server tracks each
// pilot's damage server-authoritatively and periodically issues a signed
// receipt token for the accumulated chunk. The client carries it to
// /api/events/credit-damage which validates the signature with the shared
// FORCE_PUSH_HMAC_SECRET before crediting the live event.
//
// Format: `v1.<payload-base64url>.<sig-base64url>`

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

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sigBuf);
}

export async function signBossDamageToken(payload: BossDamagePayload, secret: string): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error("FORCE_PUSH_HMAC_SECRET missing or too short on PartyKit");
  }
  const json = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(new TextEncoder().encode(json));
  const sig = await hmacSha256(secret, `${TOKEN_VERSION}.${payloadB64}`);
  const sigB64 = base64urlEncode(sig);
  return `${TOKEN_VERSION}.${payloadB64}.${sigB64}`;
}

export function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}
