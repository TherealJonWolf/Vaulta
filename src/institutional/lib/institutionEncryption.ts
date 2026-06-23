/**
 * Institution-level zero-knowledge envelope encryption.
 *
 * - Each institution sets a passphrase once (no recovery).
 * - Browser derives KEK via PBKDF2-SHA256(100k) → AES-256-GCM.
 * - Browser generates RSA-OAEP-4096 keypair; private key is wrapped with the KEK.
 * - Server only ever stores: salt, verify_blob, wrapped_private_key, public_key.
 * - Applicants and edge functions encrypt per-file/per-payload with a random AES-256-GCM
 *   data key, then wrap that data key with the institution's public key.
 * - Only the institution (after entering its passphrase) can unwrap the data key.
 */

import { deriveKeyFromPassword, encryptData, decryptData } from "@/lib/encryptionClient";
import { generateSecureRandom } from "@/lib/encryption";

export const INSTITUTION_ENCRYPTION_VERSION = "v1-rsa-oaep-4096+aes-256-gcm";
const VERIFY_STRING = "VAULTA_INST_VERIFY";

// ---------- hex helpers ----------
export const bytesToHex = (b: Uint8Array | ArrayBuffer): string => {
  const u8 = b instanceof Uint8Array ? b : new Uint8Array(b);
  let out = "";
  for (let i = 0; i < u8.length; i++) out += u8[i].toString(16).padStart(2, "0");
  return out;
};

export const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error("Invalid hex length");
  const buf = new ArrayBuffer(clean.length / 2);
  const out = new Uint8Array(buf);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out as Uint8Array<ArrayBuffer>;
};

const bufToB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const b64ToBuf = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

// ---------- RSA keypair ----------
const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const generateInstitutionKeypair = async (): Promise<CryptoKeyPair> =>
  (await crypto.subtle.generateKey(RSA_PARAMS, true, ["encrypt", "decrypt"])) as CryptoKeyPair;

export const importInstitutionPublicKey = async (spkiB64: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("spki", b64ToBuf(spkiB64), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);

const importInstitutionPrivateKey = async (pkcs8: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);

// ---------- passphrase setup / unlock ----------

export interface SetupMaterial {
  salt: string;              // hex
  verify_blob: string;       // "ivHex:ctHex"
  wrapped_private_key: string; // "ivHex:ctHex" (PKCS8 encrypted with KEK)
  public_key: string;        // base64 SPKI
}

export const buildPassphraseMaterial = async (passphrase: string): Promise<SetupMaterial> => {
  const salt = generateSecureRandom(32);
  const kek = await deriveKeyFromPassword(passphrase, salt);

  // verify blob
  const verifyBytes = new TextEncoder().encode(VERIFY_STRING);
  const verifyBuf = new ArrayBuffer(verifyBytes.byteLength);
  new Uint8Array(verifyBuf).set(verifyBytes);
  const verify = await encryptData(verifyBuf, kek);

  // keypair
  const kp = await generateInstitutionKeypair();
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  const wrapped = await encryptData(pkcs8, kek);

  return {
    salt: bytesToHex(salt),
    verify_blob: `${bytesToHex(verify.iv)}:${bytesToHex(new Uint8Array(verify.ciphertext))}`,
    wrapped_private_key: `${bytesToHex(wrapped.iv)}:${bytesToHex(new Uint8Array(wrapped.ciphertext))}`,
    public_key: bufToB64(spki),
  };
};

export interface UnlockedKeys {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export const unlockWithPassphrase = async (
  passphrase: string,
  material: SetupMaterial,
): Promise<UnlockedKeys | null> => {
  const salt = hexToBytes(material.salt);
  const kek = await deriveKeyFromPassword(passphrase, salt);

  // verify
  try {
    const [ivHex, ctHex] = material.verify_blob.split(":");
    const verified = await decryptData(hexToBytes(ctHex).buffer, kek, hexToBytes(ivHex));
    if (new TextDecoder().decode(verified) !== VERIFY_STRING) return null;
  } catch {
    return null;
  }

  // unwrap private key
  const [pivHex, pctHex] = material.wrapped_private_key.split(":");
  const pkcs8 = await decryptData(hexToBytes(pctHex).buffer, kek, hexToBytes(pivHex));
  const privateKey = await importInstitutionPrivateKey(pkcs8);
  const publicKey = await importInstitutionPublicKey(material.public_key);
  return { privateKey, publicKey };
};

// ---------- envelope encrypt / decrypt ----------

export interface SealedPayload {
  ciphertext_b64: string;
  iv_hex: string;
  wrapped_key_b64: string;
  version: string;
}

/** Encrypt arbitrary bytes for an institution using its public key only. */
export const sealForInstitution = async (
  data: ArrayBuffer,
  institutionPublicKey: CryptoKey,
): Promise<SealedPayload> => {
  const dataKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const { ciphertext, iv } = await encryptData(data, dataKey);
  const rawKey = await crypto.subtle.exportKey("raw", dataKey);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, institutionPublicKey, rawKey);
  return {
    ciphertext_b64: bufToB64(ciphertext),
    iv_hex: bytesToHex(iv),
    wrapped_key_b64: bufToB64(wrapped),
    version: INSTITUTION_ENCRYPTION_VERSION,
  };
};

/** Decrypt a sealed payload using the institution's unwrapped private key. */
export const openFromInstitution = async (
  sealed: { ciphertext_b64: string; iv_hex: string; wrapped_key_b64: string },
  institutionPrivateKey: CryptoKey,
): Promise<ArrayBuffer> => {
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    institutionPrivateKey,
    b64ToBuf(sealed.wrapped_key_b64),
  );
  const dataKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return decryptData(b64ToBuf(sealed.ciphertext_b64), dataKey, hexToBytes(sealed.iv_hex));
};

/** Encrypt a JSON-serializable value (UTF-8). */
export const sealJsonForInstitution = async (value: unknown, publicKey: CryptoKey): Promise<SealedPayload> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return sealForInstitution(buf, publicKey);
};

export const openJsonFromInstitution = async <T = unknown>(
  sealed: { ciphertext_b64: string; iv_hex: string; wrapped_key_b64: string },
  privateKey: CryptoKey,
): Promise<T> => {
  const buf = await openFromInstitution(sealed, privateKey);
  return JSON.parse(new TextDecoder().decode(buf)) as T;
};