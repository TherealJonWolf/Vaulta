import { describe, it, expect } from "vitest";
import {
  buildPassphraseMaterial,
  unlockWithPassphrase,
  importInstitutionPublicKey,
  sealForInstitution,
  openFromInstitution,
  sealJsonForInstitution,
  openJsonFromInstitution,
  hexToBytes,
} from "@/institutional/lib/institutionEncryption";

const PASSPHRASE = "correct horse battery staple seven";

describe("institutionEncryption (zero-knowledge envelope)", () => {
  it("creates passphrase material the server can store and the browser can unlock", async () => {
    const material = await buildPassphraseMaterial(PASSPHRASE);

    // What the server would persist — verify there is no plaintext key leakage.
    expect(material.salt).toMatch(/^[0-9a-f]+$/);
    expect(material.verify_blob).toContain(":");
    expect(material.wrapped_private_key).toContain(":");
    expect(material.public_key.length).toBeGreaterThan(100);

    const unlocked = await unlockWithPassphrase(PASSPHRASE, material);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.privateKey.type).toBe("private");
    expect(unlocked!.publicKey.type).toBe("public");
  }, 30000);

  it("rejects a wrong passphrase", async () => {
    const material = await buildPassphraseMaterial(PASSPHRASE);
    const unlocked = await unlockWithPassphrase("totally wrong passphrase", material);
    expect(unlocked).toBeNull();
  }, 30000);

  it("encrypts as applicant (public key only) and decrypts as institution", async () => {
    const material = await buildPassphraseMaterial(PASSPHRASE);

    // Applicant flow: only has the public key.
    const applicantPublicKey = await importInstitutionPublicKey(material.public_key);
    const fileBytes = new TextEncoder().encode("sensitive document contents");
    const fileBuf = new ArrayBuffer(fileBytes.byteLength);
    new Uint8Array(fileBuf).set(fileBytes);
    const sealed = await sealForInstitution(fileBuf, applicantPublicKey);

    // Sealed payload must not contain the plaintext anywhere.
    expect(sealed.ciphertext_b64).not.toContain("sensitive");
    expect(sealed.wrapped_key_b64.length).toBeGreaterThan(100);

    // Institution flow: unlocks with passphrase and decrypts.
    const unlocked = (await unlockWithPassphrase(PASSPHRASE, material))!;
    const opened = await openFromInstitution(sealed, unlocked.privateKey);
    expect(new TextDecoder().decode(opened)).toBe("sensitive document contents");
  }, 30000);

  it("round-trips JSON payloads (intake submission fields)", async () => {
    const material = await buildPassphraseMaterial(PASSPHRASE);
    const publicKey = await importInstitutionPublicKey(material.public_key);
    const sealed = await sealJsonForInstitution(
      { applicant_name: "Jane Doe", reference_id: "REF-123", files: ["a.pdf", "b.pdf"] },
      publicKey,
    );
    const unlocked = (await unlockWithPassphrase(PASSPHRASE, material))!;
    const opened = await openJsonFromInstitution<{ applicant_name: string; reference_id: string; files: string[] }>(
      sealed,
      unlocked.privateKey,
    );
    expect(opened.applicant_name).toBe("Jane Doe");
    expect(opened.reference_id).toBe("REF-123");
    expect(opened.files).toEqual(["a.pdf", "b.pdf"]);
  }, 30000);

  it("fails to decrypt when ciphertext is tampered with", async () => {
    const material = await buildPassphraseMaterial(PASSPHRASE);
    const publicKey = await importInstitutionPublicKey(material.public_key);
    const sealed = await sealForInstitution(new TextEncoder().encode("hello").buffer as ArrayBuffer, publicKey);
    // flip a byte in the ciphertext
    const bin = atob(sealed.ciphertext_b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    bytes[0] = bytes[0] ^ 0xff;
    const tampered = { ...sealed, ciphertext_b64: btoa(String.fromCharCode(...bytes)) };

    const unlocked = (await unlockWithPassphrase(PASSPHRASE, material))!;
    await expect(openFromInstitution(tampered, unlocked.privateKey)).rejects.toBeTruthy();
  }, 30000);

  it("hexToBytes round-trips clean", () => {
    const u = hexToBytes("deadbeef00ff");
    expect(Array.from(u)).toEqual([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
  });
});