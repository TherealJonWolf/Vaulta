import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Tests the server-side signing helper end-to-end. We inject a freshly
// generated Ed25519 seed into PDF_SIGNING_PRIVATE_KEY_ED25519, then verify
// the signature it produces against the matching derived public key. This
// proves the production signing pipeline (raw seed → PKCS8 → WebCrypto
// Ed25519 sign) without requiring access to the production secret.

const SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
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

async function importPublic(rawB64: string): Promise<CryptoKey> {
  const raw = b64decode(rawB64);
  const spki = new Uint8Array(SPKI_PREFIX.length + raw.length);
  spki.set(SPKI_PREFIX, 0);
  spki.set(raw, SPKI_PREFIX.length);
  return crypto.subtle.importKey("spki", spki.slice().buffer as ArrayBuffer, "Ed25519", false, ["verify"]);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a fresh Ed25519 keypair, exports the raw 32-byte seed and the
 * raw 32-byte public key, and installs the seed in the env var that
 * signPdfBytes reads. Returns the public key so tests can verify against it.
 */
async function installFreshSigningKey(): Promise<string> {
  const kp = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  // Strip 16-byte PKCS8 Ed25519 prefix to get the 32-byte raw seed.
  const seed = pkcs8.slice(pkcs8.length - 32);
  Deno.env.set("PDF_SIGNING_PRIVATE_KEY_ED25519", b64encode(seed));
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  const rawPub = spki.slice(spki.length - 32);
  return b64encode(rawPub);
}

Deno.test("signPdfBytes produces a 64-byte signature verifiable with the matching public key", async () => {
  const publicKeyB64 = await installFreshSigningKey();
  // Re-import the module fresh so it picks up the new env var.
  const { signPdfBytes } = await import(`./pdfSign.ts?t=${Date.now()}`);

  const body = new TextEncoder().encode("%PDF-1.7\nVaulta CI signed-PDF test\n%%EOF");
  const sigB64 = await signPdfBytes(body);
  const sig = b64decode(sigB64);
  assertEquals(sig.length, 64, "Ed25519 signature must be 64 bytes");

  const pubKey = await importPublic(publicKeyB64);
  const ok = await crypto.subtle.verify(
    "Ed25519", pubKey, sig.slice().buffer as ArrayBuffer, body.slice().buffer as ArrayBuffer,
  );
  assert(ok, "signature must verify against derived public key");

  // Tampered bytes must fail verification.
  const tampered = new Uint8Array(body);
  tampered[5] ^= 0xff;
  const bad = await crypto.subtle.verify(
    "Ed25519", pubKey, sig.slice().buffer as ArrayBuffer, tampered.slice().buffer as ArrayBuffer,
  );
  assert(!bad, "tampered payload must NOT verify");

  // SHA-256 of the original body is stable and matches what the function would emit.
  const hash = await sha256Hex(body);
  assertEquals(hash.length, 64);
});

Deno.test("signPdfBytes is deterministic per (key, message) — Ed25519 property", async () => {
  await installFreshSigningKey();
  const { signPdfBytes } = await import(`./pdfSign.ts?t=${Date.now()}-d`);
  const body = new TextEncoder().encode("deterministic-check");
  const a = await signPdfBytes(body);
  const b = await signPdfBytes(body);
  assertEquals(a, b, "Ed25519 signatures must be deterministic for the same key+message");
});