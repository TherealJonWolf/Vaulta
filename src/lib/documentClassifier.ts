/**
 * Document Classification Engine
 * 
 * Classifies uploaded documents into categories based on filename patterns
 * and MIME type to enable differentiated trust scoring.
 * 
 * Categories:
 * - identity: Government-issued IDs, passports, SSN cards, birth certificates
 * - financial: Bank statements, pay stubs, tax returns, W-2s, credit reports
 * - general: Resumes, word docs, misc PDFs, images without clear category
 */

export type DocumentCategory = 'identity' | 'financial' | 'general';

interface ClassificationResult {
  category: DocumentCategory;
  confidence: number; // 0-100
  matchedPattern: string;
  trustWeight: number; // multiplier for trust score impact
}

// Pattern sets for classification (case-insensitive matching)
const IDENTITY_PATTERNS: Array<{ pattern: RegExp; label: string; confidence: number }> = [
  { pattern: /passport/i, label: 'Passport', confidence: 95 },
  { pattern: /driver.?s?\s*licen[cs]e/i, label: "Driver's License", confidence: 95 },
  { pattern: /\bDL\b/i, label: "Driver's License", confidence: 60 },
  { pattern: /state\s*id/i, label: 'State ID', confidence: 90 },
  { pattern: /national\s*id/i, label: 'National ID', confidence: 90 },
  { pattern: /birth\s*certificate/i, label: 'Birth Certificate', confidence: 95 },
  { pattern: /social\s*security/i, label: 'Social Security Card', confidence: 95 },
  { pattern: /\bSSN\b/i, label: 'Social Security Number', confidence: 85 },
  { pattern: /\bSS\s*card\b/i, label: 'Social Security Card', confidence: 85 },
  { pattern: /green\s*card/i, label: 'Green Card', confidence: 90 },
  { pattern: /permanent\s*resident/i, label: 'Permanent Resident Card', confidence: 90 },
  { pattern: /visa\b/i, label: 'Visa Document', confidence: 75 },
  { pattern: /naturalization/i, label: 'Naturalization Certificate', confidence: 90 },
  { pattern: /identity\s*(card|document|verification)/i, label: 'Identity Document', confidence: 85 },
  { pattern: /photo\s*id/i, label: 'Photo ID', confidence: 80 },
  { pattern: /government\s*id/i, label: 'Government ID', confidence: 90 },
  { pattern: /military\s*id/i, label: 'Military ID', confidence: 90 },
  { pattern: /voter\s*(id|registration)/i, label: 'Voter ID', confidence: 80 },
  { pattern: /proof\s*of\s*(identity|citizenship)/i, label: 'Identity Proof', confidence: 85 },
];

const FINANCIAL_PATTERNS: Array<{ pattern: RegExp; label: string; confidence: number }> = [
  { pattern: /bank\s*statement/i, label: 'Bank Statement', confidence: 95 },
  { pattern: /pay\s*stub/i, label: 'Pay Stub', confidence: 95 },
  { pattern: /pay\s*slip/i, label: 'Pay Slip', confidence: 95 },
  { pattern: /\bW[\s-]?2\b/i, label: 'W-2 Form', confidence: 90 },
  { pattern: /\bW[\s-]?9\b/i, label: 'W-9 Form', confidence: 85 },
  { pattern: /\b1099\b/i, label: '1099 Form', confidence: 85 },
  { pattern: /tax\s*(return|form|document|filing|transcript)/i, label: 'Tax Document', confidence: 90 },
  { pattern: /\bIRS\b/i, label: 'IRS Document', confidence: 80 },
  { pattern: /credit\s*(report|score|history)/i, label: 'Credit Report', confidence: 90 },
  { pattern: /income\s*(verification|statement|proof)/i, label: 'Income Verification', confidence: 90 },
  { pattern: /proof\s*of\s*(income|funds|employment)/i, label: 'Income Proof', confidence: 90 },
  { pattern: /employment\s*(letter|verification)/i, label: 'Employment Verification', confidence: 85 },
  { pattern: /offer\s*letter/i, label: 'Employment Offer Letter', confidence: 75 },
  { pattern: /financial\s*statement/i, label: 'Financial Statement', confidence: 90 },
  { pattern: /investment\s*(statement|report)/i, label: 'Investment Statement', confidence: 85 },
  { pattern: /mortgage/i, label: 'Mortgage Document', confidence: 80 },
  { pattern: /loan\s*(agreement|application|statement)/i, label: 'Loan Document', confidence: 85 },
  { pattern: /utility\s*bill/i, label: 'Utility Bill', confidence: 80 },
  { pattern: /rent\s*(receipt|agreement|ledger)/i, label: 'Rental Document', confidence: 80 },
  { pattern: /lease\s*(agreement|contract)/i, label: 'Lease Agreement', confidence: 80 },
  { pattern: /insurance\s*(policy|statement|card)/i, label: 'Insurance Document', confidence: 75 },
  { pattern: /\b401k\b|\broth\s*ira\b|\bira\b/i, label: 'Retirement Account', confidence: 80 },
  { pattern: /dividend/i, label: 'Dividend Statement', confidence: 75 },
  { pattern: /profit.?loss|P\s*&\s*L/i, label: 'Profit & Loss Statement', confidence: 85 },
  { pattern: /balance\s*sheet/i, label: 'Balance Sheet', confidence: 85 },
  { pattern: /invoice/i, label: 'Invoice', confidence: 70 },
  { pattern: /receipt/i, label: 'Receipt', confidence: 65 },
  { pattern: /proof\s*of\s*(address|residence|residency)/i, label: 'Proof of Address', confidence: 80 },
  { pattern: /PCI[\s-]?complian/i, label: 'PCI Compliance Document', confidence: 70 },
  { pattern: /mastercard|visa\s*card|amex/i, label: 'Card-Related Document', confidence: 65 },
];

// Trust weight multipliers per category
const TRUST_WEIGHTS: Record<DocumentCategory, number> = {
  identity: 3.0,   // Identity docs are 3x more impactful to trust
  financial: 2.0,  // Financial docs are 2x more impactful
  general: 0.5,    // General docs contribute minimally
};

/**
 * Classify a document based on its filename and MIME type.
 */
export function classifyDocument(fileName: string, mimeType: string): ClassificationResult {
  const name = fileName.toLowerCase();

  // Check identity patterns first (higher priority)
  for (const { pattern, label, confidence } of IDENTITY_PATTERNS) {
    if (pattern.test(name)) {
      return {
        category: 'identity',
        confidence,
        matchedPattern: label,
        trustWeight: TRUST_WEIGHTS.identity,
      };
    }
  }

  // Check financial patterns
  for (const { pattern, label, confidence } of FINANCIAL_PATTERNS) {
    if (pattern.test(name)) {
      return {
        category: 'financial',
        confidence,
        matchedPattern: label,
        trustWeight: TRUST_WEIGHTS.financial,
      };
    }
  }

  // Default: general document
  return {
    category: 'general',
    confidence: 100,
    matchedPattern: 'Unclassified document',
    trustWeight: TRUST_WEIGHTS.general,
  };
}

/**
 * Get the trust score contribution for a set of categorized documents.
 * Returns a breakdown of how each category contributes.
 */
export interface DocumentTrustBreakdown {
  identityDocs: number;
  financialDocs: number;
  generalDocs: number;
  totalWeightedScore: number;
  maxPossibleScore: number;
  factors: { positive: string[]; negative: string[] };
}

export function calculateDocumentTrustContribution(
  documents: Array<{ document_category: DocumentCategory }>
): DocumentTrustBreakdown {
  const counts = { identity: 0, financial: 0, general: 0 };
  for (const doc of documents) {
    counts[doc.document_category]++;
  }

  const positive: string[] = [];
  const negative: string[] = [];

  // Identity documents (max 30 points): 15 pts for first, 8 for second, diminishing
  let identityScore = 0;
  if (counts.identity >= 2) {
    identityScore = 30;
    positive.push(`${counts.identity} identity documents verified (e.g., passport, driver's license)`);
  } else if (counts.identity === 1) {
    identityScore = 15;
    positive.push('Identity document on file');
    negative.push('Upload a second form of ID for stronger identity verification');
  } else {
    negative.push('No identity documents uploaded — upload a government-issued ID');
  }

  // Financial documents (max 25 points): 10 for first, 8 for second, diminishing
  let financialScore = 0;
  if (counts.financial >= 3) {
    financialScore = 25;
    positive.push(`${counts.financial} financial documents verified (e.g., bank statements, pay stubs)`);
  } else if (counts.financial === 2) {
    financialScore = 18;
    positive.push('Multiple financial documents on file');
  } else if (counts.financial === 1) {
    financialScore = 10;
    positive.push('Financial document on file');
    negative.push('Upload additional financial documents for stronger verification');
  } else {
    negative.push('No financial documents — upload bank statements or pay stubs');
  }

  // General documents (max 5 points)
  let generalScore = 0;
  if (counts.general >= 1) {
    generalScore = Math.min(5, counts.general * 2);
    // General docs don't generate positive factors (too weak)
  }

  const totalWeightedScore = identityScore + financialScore + generalScore;
  const maxPossibleScore = 60; // 30 + 25 + 5

  return {
    identityDocs: counts.identity,
    financialDocs: counts.financial,
    generalDocs: counts.general,
    totalWeightedScore,
    maxPossibleScore,
    factors: { positive, negative },
  };
}
