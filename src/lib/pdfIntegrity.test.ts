import { describe, it, expect } from "vitest";
import { verifyPdfResponse, IntegrityError, SignatureError, sha256Hex } from "./pdfIntegrity";

// End-to-end signed-PDF round trip:
//   1. Generate a fresh Ed25519 keypair via WebCrypto (Node 20+).
//   2. Sign sample "PDF" bytes the way the edge function does.
//   3. Build a fetch Response with X-Content-SHA256 and X-Content-Signature
//      headers identical to the production format.
//   4. Verify it round-trips through verifyPdfResponse.
//   5. Tamper each field and assert the matching error class is thrown.

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function generateSignedPdf(body: Uint8Array) {
  const kp = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  // Strip the 12-byte SPKI Ed25519 prefix to get the raw 32-byte key.
  const rawPub = spki.slice(spki.length - 32);
  const publicKeyB64 = bytesToB64(rawPub);
  const sigBuf = await crypto.subtle.sign("Ed25519", kp.privateKey, body.slice().buffer as ArrayBuffer);
  const signature = bytesToB64(new Uint8Array(sigBuf));
  const sha256 = await sha256Hex(body);
  return { publicKeyB64, signature, sha256 };
}

function makeResponse(body: Uint8Array, headers: Record<string, string>): Response {
  // jsdom Response accepts BodyInit; clone into a fresh buffer per call.
  return new Response(body.slice().buffer as ArrayBuffer, { headers });
}

describe("verifyPdfResponse — signed PDF end-to-end", () => {
  it("accepts a PDF with matching SHA-256 and Ed25519 signature", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\nVaulta test payload\n%%EOF");
    const { publicKeyB64, signature, sha256 } = await generateSignedPdf(body);

    const res = makeResponse(body, {
      "X-Content-SHA256": sha256,
      "X-Content-Signature": signature,
      "X-Content-Signature-Alg": "Ed25519",
    });

    const result = await verifyPdfResponse(res, { publicKeyB64 });
    expect(result.sha256).toBe(sha256);
    expect(result.signature).toBe(signature);
    expect(result.bytes.length).toBe(body.length);
  });

  it("rejects a PDF whose bytes were tampered with (SHA mismatch)", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\noriginal\n%%EOF");
    const { publicKeyB64, signature, sha256 } = await generateSignedPdf(body);

    const tampered = new Uint8Array(body);
    tampered[10] = tampered[10] ^ 0xff;

    const res = makeResponse(tampered, {
      "X-Content-SHA256": sha256,
      "X-Content-Signature": signature,
      "X-Content-Signature-Alg": "Ed25519",
    });

    await expect(verifyPdfResponse(res, { publicKeyB64 })).rejects.toBeInstanceOf(IntegrityError);
  });

  it("rejects a PDF whose signature does not match the bytes", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\nbody\n%%EOF");
    const { publicKeyB64, sha256 } = await generateSignedPdf(body);
    const { signature: otherSig } = await generateSignedPdf(
      new TextEncoder().encode("different payload"),
    );

    const res = makeResponse(body, {
      "X-Content-SHA256": sha256,
      "X-Content-Signature": otherSig,
      "X-Content-Signature-Alg": "Ed25519",
    });

    await expect(verifyPdfResponse(res, { publicKeyB64 })).rejects.toBeInstanceOf(SignatureError);
  });

  it("rejects a PDF signed by a different key", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\nimposter\n%%EOF");
    const trusted = await generateSignedPdf(body);
    const imposter = await generateSignedPdf(body);

    const res = makeResponse(body, {
      "X-Content-SHA256": imposter.sha256,
      "X-Content-Signature": imposter.signature,
      "X-Content-Signature-Alg": "Ed25519",
    });

    await expect(
      verifyPdfResponse(res, { publicKeyB64: trusted.publicKeyB64 }),
    ).rejects.toBeInstanceOf(SignatureError);
  });

  it("rejects a PDF missing the signature header", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\nno sig\n%%EOF");
    const { publicKeyB64, sha256 } = await generateSignedPdf(body);

    const res = makeResponse(body, { "X-Content-SHA256": sha256 });
    await expect(verifyPdfResponse(res, { publicKeyB64 })).rejects.toBeInstanceOf(SignatureError);
  });

  it("rejects an unsupported signature algorithm", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\nbad alg\n%%EOF");
    const { publicKeyB64, signature, sha256 } = await generateSignedPdf(body);

    const res = makeResponse(body, {
      "X-Content-SHA256": sha256,
      "X-Content-Signature": signature,
      "X-Content-Signature-Alg": "rsa-pss",
    });
    await expect(verifyPdfResponse(res, { publicKeyB64 })).rejects.toBeInstanceOf(SignatureError);
  });
});