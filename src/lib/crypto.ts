// Generate cryptographically secure recovery codes
export const generateRecoveryCodes = (count: number = 8): string[] => {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars (0, O, 1, I)
  
  for (let i = 0; i < count; i++) {
    let code = "";
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);
    
    for (let j = 0; j < 10; j++) {
      code += chars[array[j] % chars.length];
    }
    // Format as XXXXX-XXXXX
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  
  return codes;
};

// Hash a recovery code for storage (using SHA-256)
export const hashRecoveryCode = async (code: string): Promise<string> => {
  const normalizedCode = code.replace(/-/g, "").toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedCode);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

// Verify a recovery code matches a hash
export const verifyRecoveryCode = async (code: string, hash: string): Promise<boolean> => {
  const codeHash = await hashRecoveryCode(code);
  return codeHash === hash;
};
