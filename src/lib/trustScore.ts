import { supabase } from "@/integrations/supabase/client";

export interface TrustScoreResult {
  trustScore: number;
  trustLevel: "Highly Trusted" | "Trusted" | "Neutral" | "Low Trust" | "Restricted";
  confidence: "High" | "Medium" | "Low";
  positiveFactors: string[];
  negativeFactors: string[];
  explanation: string;
  recommendations: string[];
}

interface UserMetrics {
  accountAgeDays: number;
  emailVerified: boolean;
  mfaEnabled: boolean;
  loginCount: number;
  failedLoginCount: number;
  uniqueDevices: number;
  uniqueLocations: number;
  documentCount: number;
  securityEventsCount: number;
  suspiciousEvents: number;
  lastActiveDate: Date | null;
  hasRecoveryCodes: boolean;
}

// Weight constants for scoring dimensions
const WEIGHTS = {
  IDENTITY_INTEGRITY: 0.25,
  SECURITY_POSTURE: 0.30,
  BEHAVIORAL_CONSISTENCY: 0.20,
  PLATFORM_REPUTATION: 0.15,
  RISK_EVENTS: 0.10,
};

// Score thresholds
const THRESHOLDS = {
  NEW_ACCOUNT_CAP: 75,
  HIGH_RISK_CAP: 49,
  HIGHLY_TRUSTED_MIN: 90,
  TRUSTED_MIN: 70,
  NEUTRAL_MIN: 50,
  LOW_TRUST_MIN: 30,
};

async function fetchUserMetrics(userId: string): Promise<UserMetrics> {
  const now = new Date();
  
  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, mfa_enabled, email")
    .eq("user_id", userId)
    .maybeSingle();

  // Fetch login history
  const { data: loginHistory } = await supabase
    .from("login_history")
    .select("success, user_agent, ip_address, login_at")
    .eq("user_id", userId);

  // Fetch active sessions for device/location diversity
  const { data: sessions } = await supabase
    .from("active_sessions")
    .select("device_info, location, last_active_at")
    .eq("user_id", userId);

  // Fetch documents count
  const { count: documentCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Fetch security events
  const { data: securityEvents } = await supabase
    .from("security_events")
    .select("event_type, created_at")
    .eq("user_id", userId);

  // Fetch recovery codes existence
  const { count: recoveryCodeCount } = await supabase
    .from("mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("used", false);

  // Calculate metrics
  const accountCreated = profile?.created_at ? new Date(profile.created_at) : now;
  const accountAgeDays = Math.floor((now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
  
  const successfulLogins = loginHistory?.filter(l => l.success).length || 0;
  const failedLogins = loginHistory?.filter(l => !l.success).length || 0;
  
  // Unique devices from user agents
  const uniqueDevices = new Set(loginHistory?.map(l => l.user_agent).filter(Boolean)).size;
  
  // Unique locations
  const uniqueLocations = new Set(sessions?.map(s => s.location).filter(Boolean)).size;
  
  // Suspicious events (failed logins, recovery code usage, etc.)
  const suspiciousEventTypes = ['login_failed', 'recovery_code_used', 'session_revoked'];
  const suspiciousEvents = securityEvents?.filter(e => 
    suspiciousEventTypes.includes(e.event_type)
  ).length || 0;

  // Last activity
  const lastSession = sessions?.sort((a, b) => 
    new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  )[0];

  return {
    accountAgeDays,
    emailVerified: !!profile?.email,
    mfaEnabled: profile?.mfa_enabled || false,
    loginCount: successfulLogins,
    failedLoginCount: failedLogins,
    uniqueDevices,
    uniqueLocations,
    documentCount: documentCount || 0,
    securityEventsCount: securityEvents?.length || 0,
    suspiciousEvents,
    lastActiveDate: lastSession ? new Date(lastSession.last_active_at) : null,
    hasRecoveryCodes: (recoveryCodeCount || 0) > 0,
  };
}

function calculateIdentityScore(metrics: UserMetrics): { score: number; factors: { positive: string[]; negative: string[] } } {
  let score = 0;
  const positive: string[] = [];
  const negative: string[] = [];

  // Email verification (25 points)
  if (metrics.emailVerified) {
    score += 25;
    positive.push("Email address verified");
  } else {
    negative.push("Email not verified");
  }

  // Account age scoring (35 points max)
  if (metrics.accountAgeDays >= 365) {
    score += 35;
    positive.push("Account established for over 1 year");
  } else if (metrics.accountAgeDays >= 180) {
    score += 25;
    positive.push("Account age: 6+ months");
  } else if (metrics.accountAgeDays >= 90) {
    score += 15;
    positive.push("Account age: 3+ months");
  } else if (metrics.accountAgeDays >= 30) {
    score += 8;
    negative.push("Account relatively new (< 3 months)");
  } else {
    negative.push("New account (< 30 days)");
  }

  // MFA status (25 points)
  if (metrics.mfaEnabled) {
    score += 25;
    positive.push("Multi-factor authentication enabled");
  } else {
    negative.push("MFA not enabled");
  }

  // Recovery codes setup (15 points)
  if (metrics.hasRecoveryCodes) {
    score += 15;
    positive.push("Recovery codes configured");
  }

  return { score: Math.min(100, score), factors: { positive, negative } };
}

function calculateSecurityScore(metrics: UserMetrics): { score: number; factors: { positive: string[]; negative: string[] } } {
  let score = 50; // Base score
  const positive: string[] = [];
  const negative: string[] = [];

  // MFA bonus (25 points)
  if (metrics.mfaEnabled) {
    score += 25;
    positive.push("Strong authentication with MFA");
  } else {
    score -= 15;
  }

  // Failed login ratio penalty
  const totalLogins = metrics.loginCount + metrics.failedLoginCount;
  if (totalLogins > 0) {
    const failRatio = metrics.failedLoginCount / totalLogins;
    if (failRatio < 0.05) {
      score += 15;
      positive.push("Excellent login success rate");
    } else if (failRatio < 0.15) {
      score += 5;
      positive.push("Good login success rate");
    } else if (failRatio > 0.30) {
      score -= 20;
      negative.push("High failed login rate detected");
    }
  }

  // Device consistency (max 15 points)
  if (metrics.uniqueDevices <= 2 && metrics.loginCount >= 5) {
    score += 15;
    positive.push("Consistent device usage patterns");
  } else if (metrics.uniqueDevices > 5) {
    score -= 10;
    negative.push("Many different devices detected");
  }

  // Suspicious events penalty
  if (metrics.suspiciousEvents === 0) {
    score += 10;
    positive.push("No suspicious activity detected");
  } else if (metrics.suspiciousEvents <= 2) {
    score -= 5;
    negative.push("Minor security events recorded");
  } else {
    score -= 20;
    negative.push("Multiple security events on record");
  }

  return { score: Math.max(0, Math.min(100, score)), factors: { positive, negative } };
}

function calculateBehavioralScore(metrics: UserMetrics): { score: number; factors: { positive: string[]; negative: string[] } } {
  let score = 50;
  const positive: string[] = [];
  const negative: string[] = [];

  // Regular usage patterns
  if (metrics.loginCount >= 20) {
    score += 20;
    positive.push("Regular platform engagement");
  } else if (metrics.loginCount >= 10) {
    score += 10;
    positive.push("Moderate platform usage");
  } else if (metrics.loginCount < 3) {
    score -= 10;
    negative.push("Limited usage history");
  }

  // Recent activity
  if (metrics.lastActiveDate) {
    const daysSinceActive = Math.floor(
      (new Date().getTime() - metrics.lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceActive <= 7) {
      score += 15;
      positive.push("Recently active on platform");
    } else if (daysSinceActive > 90) {
      score -= 10;
      negative.push("Inactive for extended period");
    }
  }

  // Document engagement
  if (metrics.documentCount >= 10) {
    score += 15;
    positive.push("Active document management");
  } else if (metrics.documentCount >= 3) {
    score += 8;
    positive.push("Using document storage");
  }

  return { score: Math.max(0, Math.min(100, score)), factors: { positive, negative } };
}

function calculateReputationScore(metrics: UserMetrics): { score: number; factors: { positive: string[]; negative: string[] } } {
  let score = 60; // Neutral baseline
  const positive: string[] = [];
  const negative: string[] = [];

  // Profile completeness proxy (email verified)
  if (metrics.emailVerified) {
    score += 15;
    positive.push("Verified account identity");
  }

  // Account longevity bonus
  if (metrics.accountAgeDays >= 180) {
    score += 15;
    positive.push("Established platform member");
  }

  // Clean security record
  if (metrics.suspiciousEvents === 0 && metrics.failedLoginCount <= 2) {
    score += 10;
    positive.push("Clean security history");
  }

  return { score: Math.max(0, Math.min(100, score)), factors: { positive, negative } };
}

function calculateRiskScore(metrics: UserMetrics): { score: number; riskCap: number | null; factors: { positive: string[]; negative: string[] } } {
  let score = 100; // Start at max, deduct for risks
  let riskCap: number | null = null;
  const positive: string[] = [];
  const negative: string[] = [];

  // High failed login activity = potential breach attempt
  if (metrics.failedLoginCount > 10) {
    score -= 40;
    riskCap = THRESHOLDS.HIGH_RISK_CAP;
    negative.push("CRITICAL: Excessive failed login attempts");
  }

  // Many suspicious events
  if (metrics.suspiciousEvents > 5) {
    score -= 30;
    riskCap = THRESHOLDS.HIGH_RISK_CAP;
    negative.push("CRITICAL: Multiple security incidents detected");
  }

  // No MFA on established account
  if (!metrics.mfaEnabled && metrics.accountAgeDays > 30) {
    score -= 15;
    negative.push("Account lacks MFA protection");
  }

  if (score >= 80) {
    positive.push("No high-risk events detected");
  }

  return { score: Math.max(0, score), riskCap, factors: { positive, negative } };
}

function determineTrustLevel(score: number): TrustScoreResult["trustLevel"] {
  if (score >= THRESHOLDS.HIGHLY_TRUSTED_MIN) return "Highly Trusted";
  if (score >= THRESHOLDS.TRUSTED_MIN) return "Trusted";
  if (score >= THRESHOLDS.NEUTRAL_MIN) return "Neutral";
  if (score >= THRESHOLDS.LOW_TRUST_MIN) return "Low Trust";
  return "Restricted";
}

function determineConfidence(metrics: UserMetrics): TrustScoreResult["confidence"] {
  // High confidence requires sufficient data
  const dataPoints = 
    (metrics.loginCount >= 10 ? 1 : 0) +
    (metrics.accountAgeDays >= 30 ? 1 : 0) +
    (metrics.securityEventsCount >= 0 ? 1 : 0) +
    (metrics.documentCount >= 1 ? 1 : 0);

  if (dataPoints >= 4 && metrics.accountAgeDays >= 60) return "High";
  if (dataPoints >= 2 && metrics.accountAgeDays >= 14) return "Medium";
  return "Low";
}

function generateRecommendations(metrics: UserMetrics, score: number): string[] {
  const recommendations: string[] = [];

  if (!metrics.mfaEnabled) {
    recommendations.push("Enable multi-factor authentication for enhanced security");
  }

  if (!metrics.hasRecoveryCodes && metrics.mfaEnabled) {
    recommendations.push("Generate and securely store recovery codes");
  }

  if (metrics.accountAgeDays < 30) {
    recommendations.push("Continue using the platform to build trust history");
  }

  if (metrics.documentCount < 3) {
    recommendations.push("Upload important documents to demonstrate platform engagement");
  }

  if (metrics.failedLoginCount > 3) {
    recommendations.push("Review login history for any unauthorized access attempts");
  }

  if (score < THRESHOLDS.TRUSTED_MIN) {
    recommendations.push("Maintain consistent, secure login patterns to improve trust score");
  }

  return recommendations.slice(0, 4); // Max 4 recommendations
}

function generateExplanation(score: number, metrics: UserMetrics, positiveFactors: string[], negativeFactors: string[]): string {
  const level = determineTrustLevel(score);
  
  let explanation = `Trust score of ${score}/100 (${level}). `;
  
  if (metrics.accountAgeDays < 30) {
    explanation += "As a new account, the score is capped while trust history is established. ";
  }
  
  if (positiveFactors.length > negativeFactors.length) {
    explanation += "The score reflects strong security practices and consistent platform usage. ";
  } else if (negativeFactors.length > positiveFactors.length) {
    explanation += "Several factors are limiting the trust score. Review recommendations to improve. ";
  } else {
    explanation += "The score reflects a balanced security posture with room for improvement. ";
  }

  if (metrics.mfaEnabled) {
    explanation += "MFA protection significantly strengthens account security.";
  } else {
    explanation += "Enabling MFA would substantially improve this score.";
  }

  return explanation;
}

export async function calculateTrustScore(userId: string): Promise<TrustScoreResult> {
  const metrics = await fetchUserMetrics(userId);

  // Calculate individual dimension scores
  const identity = calculateIdentityScore(metrics);
  const security = calculateSecurityScore(metrics);
  const behavioral = calculateBehavioralScore(metrics);
  const reputation = calculateReputationScore(metrics);
  const risk = calculateRiskScore(metrics);

  // Combine factors
  const positiveFactors = [
    ...identity.factors.positive,
    ...security.factors.positive,
    ...behavioral.factors.positive,
    ...reputation.factors.positive,
    ...risk.factors.positive,
  ];

  const negativeFactors = [
    ...identity.factors.negative,
    ...security.factors.negative,
    ...behavioral.factors.negative,
    ...reputation.factors.negative,
    ...risk.factors.negative,
  ];

  // Calculate weighted score
  let rawScore = Math.round(
    identity.score * WEIGHTS.IDENTITY_INTEGRITY +
    security.score * WEIGHTS.SECURITY_POSTURE +
    behavioral.score * WEIGHTS.BEHAVIORAL_CONSISTENCY +
    reputation.score * WEIGHTS.PLATFORM_REPUTATION +
    risk.score * WEIGHTS.RISK_EVENTS
  );

  // Apply caps
  if (risk.riskCap !== null) {
    rawScore = Math.min(rawScore, risk.riskCap);
  }

  if (metrics.accountAgeDays < 30) {
    rawScore = Math.min(rawScore, THRESHOLDS.NEW_ACCOUNT_CAP);
  }

  const trustScore = Math.max(0, Math.min(100, rawScore));
  const trustLevel = determineTrustLevel(trustScore);
  const confidence = determineConfidence(metrics);
  const recommendations = generateRecommendations(metrics, trustScore);
  const explanation = generateExplanation(trustScore, metrics, positiveFactors, negativeFactors);

  return {
    trustScore,
    trustLevel,
    confidence,
    positiveFactors,
    negativeFactors,
    explanation,
    recommendations,
  };
}

export async function saveTrustScore(userId: string, result: TrustScoreResult): Promise<void> {
  // Map trust level to database enum
  const trustLevelMap: Record<TrustScoreResult["trustLevel"], string> = {
    "Highly Trusted": "highly_trusted",
    "Trusted": "trusted",
    "Neutral": "neutral",
    "Low Trust": "low_trust",
    "Restricted": "restricted",
  };

  await (supabase.from("trust_scores") as any).insert({
    user_id: userId,
    trust_score: result.trustScore,
    trust_level: trustLevelMap[result.trustLevel],
    confidence: result.confidence,
    positive_factors: result.positiveFactors,
    negative_factors: result.negativeFactors,
    explanation: result.explanation,
    recommendations: result.recommendations,
    calculated_at: new Date().toISOString(),
  });
}

export async function getLatestTrustScore(userId: string): Promise<TrustScoreResult | null> {
  const { data } = await (supabase
    .from("trust_scores") as any)
    .select("*")
    .eq("user_id", userId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const trustLevelMap: Record<string, TrustScoreResult["trustLevel"]> = {
    "highly_trusted": "Highly Trusted",
    "trusted": "Trusted",
    "neutral": "Neutral",
    "low_trust": "Low Trust",
    "restricted": "Restricted",
  };

  return {
    trustScore: data.trust_score,
    trustLevel: trustLevelMap[data.trust_level] || "Neutral",
    confidence: data.confidence,
    positiveFactors: data.positive_factors || [],
    negativeFactors: data.negative_factors || [],
    explanation: data.explanation,
    recommendations: data.recommendations || [],
  };
}
