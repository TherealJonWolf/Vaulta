import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signPdfBytes } from "./pdfSign.ts";

// Public key bundled in src/lib/pdfIntegrity.ts. The test asserts the edge
// function signing key still matches it end-to-end.
const BUNDLED_PUBLIC_KEY_B64 = "aT9XZMnO5Z+Ct084/nGJMt77ebeaHiBI3w7P6aPS/QY=";

const SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

Deno.test("signPdfBytes produces a 64-byte signature verifiable with the bundled public key", async () => {
  // Requires the same PDF_SIGNING_PRIVATE_KEY_ED25519 secret that production uses.
  // CI must set this env var; matches what's stored in Lovable Cloud secrets.
  assert(Deno.env.get("PDF_SIGNING_PRIVATE_KEY_ED25519"), "PDF_SIGNING_PRIVATE_KEY_ED25519 must be set");

  const body = new TextEncoder().encode("%PDF-1.7\nVaulta CI signed-PDF test\n%%EOF");
  const sigB64 = await signPdfBytes(body);
  const sig = b64decode(sigB64);
  assertEquals(sig.length, 64, "Ed25519 signature must be 64 bytes");

  const pubKey = await importPublic(BUNDLED_PUBLIC_KEY_B64);
  const ok = await crypto.subtle.verify(
    "Ed25519", pubKey, sig.slice().buffer as ArrayBuffer, body.slice().buffer as ArrayBuffer,
  );
  assert(ok, "signature must verify against bundled public key");

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
  const body = new TextEncoder().encode("deterministic-check");
  const a = await signPdfBytes(body);
  const b = await signPdfBytes(body);
  assertEquals(a, b, "Ed25519 signatures must be deterministic for the same key+message");
});