import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SealedPayload,
  buildPassphraseMaterial,
  openFromInstitution,
  openJsonFromInstitution,
  sealForInstitution,
  sealJsonForInstitution,
  unlockWithPassphrase,
  UnlockedKeys,
} from "@/institutional/lib/institutionEncryption";

/**
 * Institution-wide zero-knowledge vault.
 *
 * Mirrors useVaultEncryption but at the institution level: every member of an
 * institution shares the same passphrase. The server only stores ciphertext,
 * the salt, the verification blob, the wrapped private key, and the public
 * key — never the passphrase, KEK, or the private key.
 */
export const useInstitutionVault = (institutionId: string | null) => {
  const [keys, setKeys] = useState<UnlockedKeys | null>(null);
  const [hasPassphrase, setHasPassphrase] = useState<boolean | null>(null);

  const checkPassphraseExists = useCallback(async () => {
    if (!institutionId) return false;
    const { data } = await (supabase.from as any)("institution_passphrases")
      .select("institution_id")
      .eq("institution_id", institutionId)
      .maybeSingle();
    const exists = !!data;
    setHasPassphrase(exists);
    return exists;
  }, [institutionId]);

  const createPassphrase = useCallback(async (passphrase: string) => {
    if (!institutionId) throw new Error("No institution context");
    const material = await buildPassphraseMaterial(passphrase);
    const { error } = await (supabase.from as any)("institution_passphrases").insert({
      institution_id: institutionId,
      ...material,
    });
    if (error) throw error;
    const unlocked = await unlockWithPassphrase(passphrase, material);
    if (!unlocked) throw new Error("Internal verification failed");
    setKeys(unlocked);
    setHasPassphrase(true);
  }, [institutionId]);

  const unlockVault = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!institutionId) return false;
    const { data } = await (supabase.from as any)("institution_passphrases")
      .select("salt, verify_blob, wrapped_private_key, public_key")
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!data) return false;
    const unlocked = await unlockWithPassphrase(passphrase, data as any);
    if (!unlocked) return false;
    setKeys(unlocked);
    return true;
  }, [institutionId]);

  const lockVault = useCallback(() => setKeys(null), []);

  const encryptBytes = useCallback(async (bytes: ArrayBuffer): Promise<SealedPayload> => {
    if (!keys) throw new Error("Vault locked");
    return sealForInstitution(bytes, keys.publicKey);
  }, [keys]);

  const encryptJson = useCallback(async (value: unknown): Promise<SealedPayload> => {
    if (!keys) throw new Error("Vault locked");
    return sealJsonForInstitution(value, keys.publicKey);
  }, [keys]);

  const decryptBytes = useCallback(async (sealed: { ciphertext_b64: string; iv_hex: string; wrapped_key_b64: string }) => {
    if (!keys) throw new Error("Vault locked");
    return openFromInstitution(sealed, keys.privateKey);
  }, [keys]);

  const decryptJson = useCallback(async <T = unknown>(sealed: { ciphertext_b64: string; iv_hex: string; wrapped_key_b64: string }) => {
    if (!keys) throw new Error("Vault locked");
    return openJsonFromInstitution<T>(sealed, keys.privateKey);
  }, [keys]);

  return {
    isUnlocked: !!keys,
    hasPassphrase,
    checkPassphraseExists,
    createPassphrase,
    unlockVault,
    lockVault,
    encryptBytes,
    encryptJson,
    decryptBytes,
    decryptJson,
  };
};