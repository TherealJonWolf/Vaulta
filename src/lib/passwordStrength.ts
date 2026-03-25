export interface PasswordStrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  feedback: string[];
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push("At least 8 characters");

  if (password.length >= 12) score++;

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else feedback.push("Mix uppercase and lowercase letters");

  if (/\d/.test(password)) score++;
  else feedback.push("Include at least one number");

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push("Include a special character (!@#$%...)");

  // Common pattern penalties
  if (/^(password|123456|qwerty|admin|letmein)/i.test(password)) {
    score = Math.max(0, score - 2);
    feedback.push("Avoid common passwords");
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push("Avoid repeated characters");
  }

  const clampedScore = Math.min(4, Math.max(0, score));

  const labels = ["Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = [
    "bg-[#E24B4A]",
    "bg-yellow-500",
    "bg-yellow-400",
    "bg-[#1D9E75]",
    "bg-[#1D9E75]",
  ];

  return {
    score: clampedScore,
    label: labels[clampedScore],
    color: colors[clampedScore],
    feedback,
  };
}

export function isPasswordAcceptable(password: string): { ok: boolean; reason?: string } {
  if (password.length < 8) return { ok: false, reason: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(password)) return { ok: false, reason: "Password must include an uppercase letter" };
  if (!/[a-z]/.test(password)) return { ok: false, reason: "Password must include a lowercase letter" };
  if (!/\d/.test(password)) return { ok: false, reason: "Password must include a number" };
  if (/^(password|123456|qwerty|admin|letmein)/i.test(password)) return { ok: false, reason: "This password is too common" };
  return { ok: true };
}
