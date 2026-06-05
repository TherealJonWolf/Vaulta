/**
 * Client-side SHA-256 integrity verification for downloaded PDFs.
 *
 * The server returns the SHA-256 of the PDF bytes via the `X-Content-SHA256`
 * response header AND an Ed25519 signature of the PDF bytes via the
 * `X-Content-Signature` header (base64, algorithm advertised in
 * `X-Content-Signature-Alg`). After downloading we (1) recompute the digest
 * on the received bytes and compare to the header, and (2) verify the
 * Ed25519 signature against the bundled platform public key. If either check
 * fails we refuse to save the file.
 */

// Ed25519 public key (raw, base64) for Vaulta-signed PDF exports.
// The matching private key lives only in the edge function environment as
// `PDF_SIGNING_PRIVATE_KEY_ED25519`. Publishing the public key here is safe.
export const PDF_SIGNING_PUBLIC_KEY_B64 = "aT9XZMnO5Z+Ct084/nGJMt77ebeaHiBI3w7P6aPS/QY=";

const SPKI_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedPubKey: CryptoKey | null = null;
async function getPublicKey(overrideB64?: string): Promise<CryptoKey> {
  if (!overrideB64 && cachedPubKey) return cachedPubKey;
  const raw = b64ToBytes(overrideB64 ?? PDF_SIGNING_PUBLIC_KEY_B64);
  const spki = new Uint8Array(SPKI_ED25519_PREFIX.length + raw.length);
  spki.set(SPKI_ED25519_PREFIX, 0);
  spki.set(raw, SPKI_ED25519_PREFIX.length);
  const key = await crypto.subtle.importKey(
    "spki",
    spki.buffer as ArrayBuffer,
    "Ed25519",
    false,
    ["verify"],
  );
  if (!overrideB64) cachedPubKey = key;
  return key;
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf: ArrayBuffer = bytes instanceof Uint8Array
    ? bytes.slice().buffer as ArrayBuffer
    : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class IntegrityError extends Error {
  constructor(public expected: string, public actual: string) {
    super(`PDF integrity check failed: expected ${expected}, got ${actual}`);
    this.name = "IntegrityError";
  }
}

export class SignatureError extends Error {
  constructor(public reason: string) {
    super(`PDF signature verification failed: ${reason}`);
    this.name = "SignatureError";
  }
}

/**
 * Reads the PDF body from a fetch Response and verifies the SHA-256 hash
 * advertised in the `X-Content-SHA256` header AND the Ed25519 signature
 * advertised in the `X-Content-Signature` header. Returns the verified
 * bytes, the hash, and the (already verified) signature so callers can
 * surface them to the user / audit log.
 */
export async function verifyPdfResponse(
  res: Response,
  opts: { publicKeyB64?: string } = {},
): Promise<{ bytes: Uint8Array; sha256: string; signature: string }> {
  const expected = (res.headers.get("X-Content-SHA256") || "").toLowerCase();
  const signatureB64 = res.headers.get("X-Content-Signature") || "";
  const alg = (res.headers.get("X-Content-Signature-Alg") || "").toLowerCase();
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const actual = await sha256Hex(buf);
  if (!expected) {
    throw new IntegrityError("(missing header)", actual);
  }
  if (expected !== actual) {
    throw new IntegrityError(expected, actual);
  }

  if (!signatureB64) {
    throw new SignatureError("missing X-Content-Signature header");
  }
  if (alg && alg !== "ed25519") {
    throw new SignatureError(`unsupported signature algorithm: ${alg}`);
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = b64ToBytes(signatureB64);
  } catch {
    throw new SignatureError("signature is not valid base64");
  }
  if (sigBytes.length !== 64) {
    throw new SignatureError(`expected 64-byte Ed25519 signature, got ${sigBytes.length}`);
  }
  let ok = false;
  try {
    const key = await getPublicKey(opts.publicKeyB64);
    ok = await crypto.subtle.verify(
      "Ed25519",
      key,
      sigBytes.buffer as ArrayBuffer,
      buf,
    );
  } catch (e) {
    throw new SignatureError(`verification threw: ${(e as Error).message}`);
  }
  if (!ok) {
    throw new SignatureError("signature does not match PDF bytes");
  }

  return { bytes, sha256: actual, signature: signatureB64 };
}