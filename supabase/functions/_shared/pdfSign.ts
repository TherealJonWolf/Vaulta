// Ed25519 signing helper for exported PDFs.
// Uses WebCrypto (supported in Deno) and the raw 32-byte seed stored in
// the PDF_SIGNING_PRIVATE_KEY_ED25519 secret.

const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b,
  0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const seedB64 = Deno.env.get("PDF_SIGNING_PRIVATE_KEY_ED25519");
  if (!seedB64) throw new Error("PDF_SIGNING_PRIVATE_KEY_ED25519 not configured");
  const seed = b64decode(seedB64.trim());
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length);
  pkcs8.set(PKCS8_ED25519_PREFIX, 0);
  pkcs8.set(seed, PKCS8_ED25519_PREFIX.length);
  cachedKey = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", false, ["sign"]);
  return cachedKey;
}

/**
 * Sign the given PDF bytes with the platform Ed25519 key.
 * Returns the base64-encoded 64-byte signature for the X-Content-Signature
 * response header. Clients verify it against the bundled public key in
 * src/lib/pdfIntegrity.ts.
 */
export async function signPdfBytes(bytes: Uint8Array): Promise<string> {
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign("Ed25519", key, bytes);
  return b64encode(new Uint8Array(sig));
}