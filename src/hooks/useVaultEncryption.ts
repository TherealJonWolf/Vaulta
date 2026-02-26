import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveKeyFromPassword, encryptData, decryptData, hashData, generateSecureRandom, exportKey, importKey } from "@/lib/encryption";

export const useVaultEncryption = (userId: string | undefined) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPassphrase, setHasPassphrase] = useState<boolean | null>(null);

  const checkPassphraseExists = useCallback(async () => {
    if (!userId) return false;
    const { data } = await supabase
      .from("vault_passphrases")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const exists = !!data;
    setHasPassphrase(exists);
    return exists;
  }, [userId]);

  const createPassphrase = useCallback(async (passphrase: string) => {
    if (!userId) throw new Error("Not authenticated");

    const salt = generateSecureRandom(32);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");

    // Derive encryption key from passphrase
    const key = await deriveKeyFromPassword(passphrase, salt);

    // Create a verification hash: encrypt a known string and store it
    const verificationString = "VAULTA_E2E_VERIFY";
    const encoder = new TextEncoder();
    const verificationData = encoder.encode(verificationString);
    const { ciphertext, iv } = await encryptData(verificationData.buffer, key);

    // Store salt, IV + ciphertext as verification hash
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    const ctBytes = new Uint8Array(ciphertext);
    const ctHex = Array.from(ctBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const verificationHash = `${ivHex}:${ctHex}`;

    const { error } = await supabase.from("vault_passphrases").insert({
      user_id: userId,
      salt: saltHex,
      verification_hash: verificationHash,
    });

    if (error) throw error;

    setEncryptionKey(key);
    setIsUnlocked(true);
    setHasPassphrase(true);
  }, [userId]);

  const unlockVault = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!userId) return false;

    const { data } = await supabase
      .from("vault_passphrases")
      .select("salt, verification_hash")
      .eq("user_id", userId)
      .single();

    if (!data) return false;

    // Reconstruct salt
    const saltBytes = new Uint8Array(
      data.salt.match(/.{2}/g)!.map((h: string) => parseInt(h, 16))
    );

    // Derive key from passphrase + stored salt
    const key = await deriveKeyFromPassword(passphrase, saltBytes);

    // Verify by decrypting the verification hash
    try {
      const [ivHex, ctHex] = data.verification_hash.split(":");
      const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h: string) => parseInt(h, 16)));
      const ct = new Uint8Array(ctHex.match(/.{2}/g)!.map((h: string) => parseInt(h, 16)));

      const decrypted = await decryptData(ct.buffer, key, iv);
      const text = new TextDecoder().decode(decrypted);

      if (text === "VAULTA_E2E_VERIFY") {
        setEncryptionKey(key);
        setIsUnlocked(true);
        return true;
      }
    } catch {
      // Decryption failed = wrong passphrase
      return false;
    }

    return false;
  }, [userId]);

  const encryptFile = useCallback(async (fileBuffer: ArrayBuffer): Promise<{ encrypted: ArrayBuffer; iv: string }> => {
    if (!encryptionKey) throw new Error("Vault not unlocked");
    const { ciphertext, iv } = await encryptData(fileBuffer, encryptionKey);
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    return { encrypted: ciphertext, iv: ivHex };
  }, [encryptionKey]);

  const decryptFile = useCallback(async (encryptedBuffer: ArrayBuffer, ivHex: string): Promise<ArrayBuffer> => {
    if (!encryptionKey) throw new Error("Vault not unlocked");
    const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h: string) => parseInt(h, 16)));
    return await decryptData(encryptedBuffer, encryptionKey, iv);
  }, [encryptionKey]);

  const lockVault = useCallback(() => {
    setEncryptionKey(null);
    setIsUnlocked(false);
  }, []);

  return {
    isUnlocked,
    hasPassphrase,
    checkPassphraseExists,
    createPassphrase,
    unlockVault,
    encryptFile,
    decryptFile,
    lockVault,
  };
};
