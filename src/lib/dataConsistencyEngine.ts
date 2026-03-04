/**
 * Data Consistency & Trust Degradation Engine
 * 
 * Evaluates structured financial and identity data for internal consistency,
 * temporal logic, behavioral patterns, and cross-field reconciliation.
 * 
 * Philosophy: The system never asks "is this fake?" —
 * it asks "does this data remain coherent under scrutiny over time?"
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Severity = 'low' | 'medium' | 'high';
export type FollowUpAction = 'none' | 'soft_review' | 'hard_review';
export type RuleCategory =
  | 'arithmetic_reconciliation'
  | 'temporal_logic'
  | 'behavioral_sequence'
  | 'cross_field_consistency'
  | 'entropy_pattern'
  | 'trust_degradation';

export interface RuleFinding {
  ruleId: string;
  ruleCategory: RuleCategory;
  ruleName: string;
  description: string;
  triggerCondition: string;
  severity: Severity;
  confidenceImpact: number; // positive = boost, negative = degrade
  followUpAction: FollowUpAction;
  auditLogEntry: string;
  metadata: Record<string, unknown>;
}

export interface ConsistencyReport {
  userId: string;
  findings: RuleFinding[];
  aggregateConfidenceAdjustment: number;
  trustCeiling: number | null; // null = no cap imposed
  compoundAnomalyCount: number;
  evaluatedAt: string;
}

// ─── Data Models (inputs to the engine) ──────────────────────────────────────

export interface TransactionRecord {
  id: string;
  date: string; // ISO date
  amount: number;
  type: 'credit' | 'debit';
  description?: string;
  category?: string;
  balance_after?: number;
}

export interface StatementDataset {
  institutionName?: string;
  accountId?: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  transactions: TransactionRecord[];
  currency?: string;
}

export interface IncomeModel {
  employerName?: string;
  payerIdentity?: string;
  declaredAnnualIncome?: number;
  declaredMonthlyIncome?: number;
  payFrequency?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  payStubs?: Array<{
    date: string;
    grossAmount: number;
    netAmount: number;
  }>;
}

export interface IdentityAttributes {
  fullName?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
}

export interface DataConsistencyInput {
  userId: string;
  accountCreatedAt: string;
  statements?: StatementDataset[];
  income?: IncomeModel;
  identity?: IdentityAttributes;
  uploadHistory?: Array<{
    fileName: string;
    uploadedAt: string;
    sha256Hash: string;
    fileSize: number;
  }>;
  priorFindingsCount?: number;
}

// ─── Rule Definitions ────────────────────────────────────────────────────────

// 1. ARITHMETIC & RECONCILIATION RULES

function checkBalanceReconciliation(statement: StatementDataset): RuleFinding | null {
  const txnNet = statement.transactions.reduce((sum, tx) => {
    return sum + (tx.type === 'credit' ? tx.amount : -tx.amount);
  }, 0);

  const expectedClosing = Math.round((statement.openingBalance + txnNet) * 100) / 100;
  const actualClosing = Math.round(statement.closingBalance * 100) / 100;
  const diff = Math.abs(expectedClosing - actualClosing);

  if (diff > 0.01) {
    const isLarge = diff > 100;
    return {
      ruleId: 'AR-001',
      ruleCategory: 'arithmetic_reconciliation',
      ruleName: 'Balance Reconciliation Failure',
      description: `Opening balance (${statement.openingBalance}) + transactions (${txnNet.toFixed(2)}) ≠ closing balance (${statement.closingBalance}). Discrepancy: ${diff.toFixed(2)}`,
      triggerCondition: 'opening_balance + sum(transactions) ≠ closing_balance beyond ±$0.01 tolerance',
      severity: isLarge ? 'high' : 'medium',
      confidenceImpact: isLarge ? -25 : -10,
      followUpAction: isLarge ? 'hard_review' : 'soft_review',
      auditLogEntry: `Balance reconciliation failed for period ${statement.periodStart}–${statement.periodEnd}. Δ${diff.toFixed(2)}`,
      metadata: { expectedClosing, actualClosing, difference: diff, period: `${statement.periodStart}/${statement.periodEnd}` },
    };
  }
  return null;
}

function checkRoundingAnomalies(statement: StatementDataset): RuleFinding | null {
  const roundedCount = statement.transactions.filter(tx => tx.amount === Math.round(tx.amount)).length;
  const total = statement.transactions.length;
  if (total < 10) return null;

  const roundedRatio = roundedCount / total;
  // Real financial data typically has < 30% perfectly round numbers
  if (roundedRatio > 0.7) {
    return {
      ruleId: 'AR-002',
      ruleCategory: 'arithmetic_reconciliation',
      ruleName: 'Excessive Rounding Pattern',
      description: `${(roundedRatio * 100).toFixed(0)}% of transactions are perfectly round numbers (${roundedCount}/${total})`,
      triggerCondition: '> 70% of transactions are whole-number amounts in a dataset of ≥ 10 transactions',
      severity: 'medium',
      confidenceImpact: -12,
      followUpAction: 'soft_review',
      auditLogEntry: `Rounding anomaly detected: ${roundedCount}/${total} transactions are round numbers`,
      metadata: { roundedCount, total, roundedRatio },
    };
  }
  return null;
}

function checkBalanceJumps(statement: StatementDataset): RuleFinding | null {
  if (statement.transactions.length < 5) return null;

  // Sort by date
  const sorted = [...statement.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.balance_after != null && curr.balance_after != null) {
      const expectedBalance = prev.balance_after + (curr.type === 'credit' ? curr.amount : -curr.amount);
      const balanceDiff = Math.abs(expectedBalance - curr.balance_after);
      if (balanceDiff > 1) {
        return {
          ruleId: 'AR-003',
          ruleCategory: 'arithmetic_reconciliation',
          ruleName: 'Unsupported Balance Jump',
          description: `Balance jumped by ${balanceDiff.toFixed(2)} between consecutive transactions without supporting entry`,
          triggerCondition: 'Sequential balance_after values are inconsistent with the intervening transaction amount',
          severity: balanceDiff > 500 ? 'high' : 'medium',
          confidenceImpact: balanceDiff > 500 ? -20 : -8,
          followUpAction: 'soft_review',
          auditLogEntry: `Unsupported balance jump of ${balanceDiff.toFixed(2)} detected between txn ${prev.id} and ${curr.id}`,
          metadata: { prevTxn: prev.id, currTxn: curr.id, expectedBalance, actualBalance: curr.balance_after, gap: balanceDiff },
        };
      }
    }
  }
  return null;
}

// 2. TEMPORAL LOGIC RULES

function checkOverlappingPeriods(statements: StatementDataset[]): RuleFinding | null {
  if (statements.length < 2) return null;

  const sorted = [...statements].sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(sorted[i - 1].periodEnd).getTime();
    const currStart = new Date(sorted[i].periodStart).getTime();
    if (currStart < prevEnd) {
      return {
        ruleId: 'TL-001',
        ruleCategory: 'temporal_logic',
        ruleName: 'Overlapping Statement Periods',
        description: `Statement periods overlap: ${sorted[i - 1].periodEnd} > ${sorted[i].periodStart}`,
        triggerCondition: 'Two statement periods have overlapping date ranges',
        severity: 'high',
        confidenceImpact: -20,
        followUpAction: 'hard_review',
        auditLogEntry: `Overlapping statement periods detected between ${sorted[i - 1].periodStart}–${sorted[i - 1].periodEnd} and ${sorted[i].periodStart}–${sorted[i].periodEnd}`,
        metadata: { period1: `${sorted[i - 1].periodStart}/${sorted[i - 1].periodEnd}`, period2: `${sorted[i].periodStart}/${sorted[i].periodEnd}` },
      };
    }
  }
  return null;
}

function checkPayrollCadence(income: IncomeModel): RuleFinding | null {
  if (!income.payStubs || income.payStubs.length < 3 || !income.payFrequency) return null;

  const expectedGapDays: Record<string, number> = {
    weekly: 7,
    biweekly: 14,
    semimonthly: 15,
    monthly: 30,
  };

  const expectedGap = expectedGapDays[income.payFrequency];
  const sorted = [...income.payStubs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const deviation = Math.abs(avgGap - expectedGap);

  if (deviation > expectedGap * 0.3) {
    return {
      ruleId: 'TL-002',
      ruleCategory: 'temporal_logic',
      ruleName: 'Payroll Cadence Mismatch',
      description: `Declared pay frequency "${income.payFrequency}" (expected ~${expectedGap}d gap) but actual average gap is ${avgGap.toFixed(1)} days`,
      triggerCondition: 'Average pay stub interval deviates > 30% from declared frequency',
      severity: 'medium',
      confidenceImpact: -15,
      followUpAction: 'soft_review',
      auditLogEntry: `Payroll cadence mismatch: declared ${income.payFrequency}, actual avg gap ${avgGap.toFixed(1)}d vs expected ${expectedGap}d`,
      metadata: { declaredFrequency: income.payFrequency, expectedGapDays: expectedGap, actualAvgGap: avgGap, gaps },
    };
  }
  return null;
}

function checkTransactionsOutsidePeriod(statement: StatementDataset): RuleFinding | null {
  const periodStart = new Date(statement.periodStart).getTime();
  const periodEnd = new Date(statement.periodEnd).getTime();

  const outsiders = statement.transactions.filter(tx => {
    const txDate = new Date(tx.date).getTime();
    return txDate < periodStart || txDate > periodEnd;
  });

  if (outsiders.length > 0) {
    return {
      ruleId: 'TL-003',
      ruleCategory: 'temporal_logic',
      ruleName: 'Transactions Outside Statement Period',
      description: `${outsiders.length} transaction(s) fall outside the declared period ${statement.periodStart}–${statement.periodEnd}`,
      triggerCondition: 'Transaction date is before period start or after period end',
      severity: 'high',
      confidenceImpact: -18,
      followUpAction: 'hard_review',
      auditLogEntry: `${outsiders.length} transactions dated outside statement period bounds`,
      metadata: { outsideCount: outsiders.length, outsiderIds: outsiders.map(t => t.id) },
    };
  }
  return null;
}

function checkRetroactiveInsertion(statement: StatementDataset): RuleFinding | null {
  if (statement.transactions.length < 5) return null;

  // Look for transactions that break chronological order of IDs (if IDs are sequential)
  // Or detect clusters of transactions on the same day that break running balance continuity
  const sorted = [...statement.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let suspiciousClusters = 0;
  const dateCounts: Record<string, number> = {};
  for (const tx of sorted) {
    const dateKey = tx.date.split('T')[0];
    dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
  }

  // Flag dates with unusually high transaction density vs the average
  const counts = Object.values(dateCounts);
  const avgCount = counts.reduce((s, c) => s + c, 0) / counts.length;
  
  for (const count of counts) {
    if (count > avgCount * 4 && count >= 8) {
      suspiciousClusters++;
    }
  }

  if (suspiciousClusters > 0) {
    return {
      ruleId: 'TL-004',
      ruleCategory: 'temporal_logic',
      ruleName: 'Retroactive Data Insertion Pattern',
      description: `${suspiciousClusters} date(s) with transaction density 4x+ above average — consistent with bulk insertion`,
      triggerCondition: 'Single-date transaction count exceeds 4x the mean daily transaction count and ≥ 8 transactions',
      severity: 'medium',
      confidenceImpact: -12,
      followUpAction: 'soft_review',
      auditLogEntry: `Retroactive insertion pattern: ${suspiciousClusters} abnormally dense transaction date(s)`,
      metadata: { suspiciousClusters, avgDailyCount: avgCount, dateCounts },
    };
  }
  return null;
}

// 3. BEHAVIORAL & SEQUENCE RULES

function checkEarlyHighTrustData(input: DataConsistencyInput): RuleFinding | null {
  const accountAge = (Date.now() - new Date(input.accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  const docCount = input.uploadHistory?.length || 0;
  const hasStatements = (input.statements?.length || 0) > 0;
  const hasIncome = !!input.income?.payStubs?.length;

  // New account (< 48 hours) submitting complex financial data
  if (accountAge < 2 && (docCount >= 3 || (hasStatements && hasIncome))) {
    return {
      ruleId: 'BS-001',
      ruleCategory: 'behavioral_sequence',
      ruleName: 'Rapid High-Trust Data Submission',
      description: `Complex financial data submitted within ${accountAge.toFixed(1)} days of account creation`,
      triggerCondition: 'Account < 48 hours old AND (≥ 3 documents OR multiple data model types submitted)',
      severity: 'medium',
      confidenceImpact: -15,
      followUpAction: 'soft_review',
      auditLogEntry: `High-trust data submitted ${accountAge.toFixed(1)} days after account creation (${docCount} docs)`,
      metadata: { accountAgeDays: accountAge, documentCount: docCount, hasStatements, hasIncome },
    };
  }
  return null;
}

function checkDuplicateDatasets(input: DataConsistencyInput): RuleFinding | null {
  if (!input.uploadHistory || input.uploadHistory.length < 2) return null;

  const hashGroups: Record<string, number> = {};
  for (const upload of input.uploadHistory) {
    hashGroups[upload.sha256Hash] = (hashGroups[upload.sha256Hash] || 0) + 1;
  }

  const duplicates = Object.entries(hashGroups).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    const totalDupes = duplicates.reduce((s, [, c]) => s + c, 0) - duplicates.length;
    return {
      ruleId: 'BS-002',
      ruleCategory: 'behavioral_sequence',
      ruleName: 'Repeated Upload of Equivalent Data',
      description: `${duplicates.length} dataset(s) uploaded multiple times (${totalDupes} duplicate uploads)`,
      triggerCondition: 'Same SHA-256 hash appears > 1 time in upload history for the same user',
      severity: 'low',
      confidenceImpact: -5,
      followUpAction: 'none',
      auditLogEntry: `${totalDupes} duplicate dataset uploads detected across ${duplicates.length} unique hashes`,
      metadata: { duplicateHashes: duplicates.map(([hash, count]) => ({ hash: hash.slice(0, 12) + '…', count })) },
    };
  }
  return null;
}

function checkIdenticalTransactionPatterns(statements: StatementDataset[]): RuleFinding | null {
  if (statements.length < 2) return null;

  // Compare transaction amount sequences across different accounts/periods
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      const seq1 = statements[i].transactions.map(t => t.amount).join(',');
      const seq2 = statements[j].transactions.map(t => t.amount).join(',');

      if (seq1.length > 20 && seq1 === seq2 && statements[i].transactions.length >= 5) {
        return {
          ruleId: 'BS-003',
          ruleCategory: 'behavioral_sequence',
          ruleName: 'Identical Transaction Pattern Across Datasets',
          description: `Two different statement periods contain identical transaction amount sequences (${statements[i].transactions.length} transactions)`,
          triggerCondition: 'Complete transaction amount sequence match between ≥ 2 distinct statement periods with ≥ 5 transactions',
          severity: 'high',
          confidenceImpact: -30,
          followUpAction: 'hard_review',
          auditLogEntry: `Identical transaction patterns found between periods ${statements[i].periodStart} and ${statements[j].periodStart}`,
          metadata: {
            period1: `${statements[i].periodStart}/${statements[i].periodEnd}`,
            period2: `${statements[j].periodStart}/${statements[j].periodEnd}`,
            transactionCount: statements[i].transactions.length,
          },
        };
      }
    }
  }
  return null;
}

function checkImprobableConsistency(statements: StatementDataset[]): RuleFinding | null {
  if (statements.length < 3) return null;

  // Check if daily balances show unnaturally low variance over many months
  const closings = statements.map(s => s.closingBalance);
  const mean = closings.reduce((s, c) => s + c, 0) / closings.length;
  const variance = closings.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / closings.length;
  const coeffOfVariation = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;

  // Real financial data across 3+ months typically has CV > 5%
  if (coeffOfVariation < 0.02 && closings.length >= 3) {
    return {
      ruleId: 'BS-004',
      ruleCategory: 'behavioral_sequence',
      ruleName: 'Improbable Financial Consistency',
      description: `Closing balances across ${closings.length} periods have a coefficient of variation of ${(coeffOfVariation * 100).toFixed(2)}% — improbably stable`,
      triggerCondition: 'Closing balance CV < 2% across ≥ 3 statement periods',
      severity: 'medium',
      confidenceImpact: -10,
      followUpAction: 'soft_review',
      auditLogEntry: `Improbably consistent closing balances (CV: ${(coeffOfVariation * 100).toFixed(2)}%) across ${closings.length} periods`,
      metadata: { closingBalances: closings, coeffOfVariation, mean, variance },
    };
  }
  return null;
}

// 4. CROSS-FIELD CONSISTENCY RULES

function checkIncomeVsInflow(statements: StatementDataset[], income: IncomeModel): RuleFinding | null {
  if (!income.declaredMonthlyIncome || statements.length === 0) return null;

  // Calculate average monthly credit inflow across all statements
  let totalCredits = 0;
  let totalMonths = 0;
  for (const stmt of statements) {
    const monthSpan = Math.max(1,
      (new Date(stmt.periodEnd).getTime() - new Date(stmt.periodStart).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    const credits = stmt.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    totalCredits += credits;
    totalMonths += monthSpan;
  }

  const avgMonthlyInflow = totalCredits / totalMonths;
  const declared = income.declaredMonthlyIncome;
  const ratio = avgMonthlyInflow / declared;

  // If total inflow is < 50% or > 300% of declared income, flag it
  if (ratio < 0.5 || ratio > 3.0) {
    return {
      ruleId: 'CF-001',
      ruleCategory: 'cross_field_consistency',
      ruleName: 'Income vs Transaction Inflow Mismatch',
      description: `Declared monthly income: $${declared.toFixed(2)}, but average monthly credit inflow: $${avgMonthlyInflow.toFixed(2)} (${(ratio * 100).toFixed(0)}%)`,
      triggerCondition: 'Average monthly credit inflow is < 50% or > 300% of declared monthly income',
      severity: ratio < 0.3 || ratio > 5 ? 'high' : 'medium',
      confidenceImpact: ratio < 0.3 || ratio > 5 ? -22 : -12,
      followUpAction: ratio < 0.3 || ratio > 5 ? 'hard_review' : 'soft_review',
      auditLogEntry: `Income–inflow mismatch: declared $${declared}/mo vs actual inflow $${avgMonthlyInflow.toFixed(2)}/mo (${(ratio * 100).toFixed(0)}%)`,
      metadata: { declaredMonthlyIncome: declared, avgMonthlyInflow, ratio, totalMonths },
    };
  }
  return null;
}

function checkEmployerConsistency(income: IncomeModel, statements: StatementDataset[]): RuleFinding | null {
  if (!income.employerName || !income.payStubs?.length || statements.length === 0) return null;

  // Look for payroll deposits that mention the employer
  const employerLower = income.employerName.toLowerCase();
  let matchingDeposits = 0;
  let totalPayrollLikeDeposits = 0;

  for (const stmt of statements) {
    for (const tx of stmt.transactions) {
      if (tx.type === 'credit' && tx.description) {
        const descLower = tx.description.toLowerCase();
        // Common payroll descriptors
        if (descLower.includes('payroll') || descLower.includes('salary') || descLower.includes('direct dep')) {
          totalPayrollLikeDeposits++;
          if (descLower.includes(employerLower) || employerLower.includes(descLower.split(' ')[0])) {
            matchingDeposits++;
          }
        }
      }
    }
  }

  if (totalPayrollLikeDeposits > 2 && matchingDeposits === 0) {
    return {
      ruleId: 'CF-002',
      ruleCategory: 'cross_field_consistency',
      ruleName: 'Employer Identity Inconsistency',
      description: `Declared employer "${income.employerName}" not found in any of ${totalPayrollLikeDeposits} payroll-like deposits`,
      triggerCondition: '≥ 3 payroll-like deposits exist but none reference declared employer name',
      severity: 'medium',
      confidenceImpact: -14,
      followUpAction: 'soft_review',
      auditLogEntry: `Employer mismatch: "${income.employerName}" absent from ${totalPayrollLikeDeposits} payroll transactions`,
      metadata: { declaredEmployer: income.employerName, totalPayrollDeposits: totalPayrollLikeDeposits, matchingDeposits },
    };
  }
  return null;
}

// 5. ENTROPY & PATTERN ANALYSIS

function checkTransactionSpacingEntropy(statement: StatementDataset): RuleFinding | null {
  if (statement.transactions.length < 10) return null;

  const sorted = [...statement.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (1000 * 60 * 60);
    gaps.push(gap);
  }

  if (gaps.length < 5) return null;

  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  // Real transactions have high variability (CV > 0.5). Uniform spacing is suspicious.
  if (cv < 0.15) {
    return {
      ruleId: 'EP-001',
      ruleCategory: 'entropy_pattern',
      ruleName: 'Unnaturally Uniform Transaction Spacing',
      description: `Transaction time gaps have CV of ${(cv * 100).toFixed(1)}% — near-uniform spacing is improbable for organic financial data`,
      triggerCondition: 'Coefficient of variation of inter-transaction time gaps < 15% with ≥ 10 transactions',
      severity: 'high',
      confidenceImpact: -20,
      followUpAction: 'hard_review',
      auditLogEntry: `Uniform transaction spacing detected (CV: ${(cv * 100).toFixed(1)}%) across ${gaps.length + 1} transactions`,
      metadata: { coeffOfVariation: cv, meanGapHours: mean, transactionCount: sorted.length },
    };
  }
  return null;
}

function checkOverlyCleanHistory(statement: StatementDataset): RuleFinding | null {
  if (statement.transactions.length < 15) return null;

  let flags = 0;

  // Check: all descriptions present and non-empty
  const allDescribed = statement.transactions.every(t => t.description && t.description.trim().length > 0);
  if (allDescribed) flags++;

  // Check: all categories present
  const allCategorized = statement.transactions.every(t => t.category && t.category.trim().length > 0);
  if (allCategorized) flags++;

  // Check: no negative or zero amounts
  const allPositive = statement.transactions.every(t => t.amount > 0);
  if (allPositive) flags++;

  // Check: no fees, charges, or penalties (suspiciously clean)
  const feeKeywords = ['fee', 'charge', 'penalty', 'overdraft', 'nsf', 'interest', 'service charge'];
  const hasFees = statement.transactions.some(t =>
    feeKeywords.some(kw => (t.description || '').toLowerCase().includes(kw))
  );
  if (!hasFees) flags++;

  if (flags >= 3) {
    return {
      ruleId: 'EP-002',
      ruleCategory: 'entropy_pattern',
      ruleName: 'Overly Clean Financial History',
      description: `Statement exhibits ${flags}/4 cleanliness indicators — no fees, all categorized, all described, all positive amounts`,
      triggerCondition: '≥ 3 of 4 cleanliness indicators present in a dataset of ≥ 15 transactions',
      severity: 'low',
      confidenceImpact: -8,
      followUpAction: 'soft_review',
      auditLogEntry: `Suspiciously clean financial data: ${flags}/4 cleanliness markers triggered`,
      metadata: { cleanlinessScore: flags, allDescribed, allCategorized, allPositive, noFees: !hasFees },
    };
  }
  return null;
}

function checkTemplatedStructure(statements: StatementDataset[]): RuleFinding | null {
  if (statements.length < 2) return null;

  // Check if transaction counts are identical across all periods
  const counts = statements.map(s => s.transactions.length);
  const allSame = counts.every(c => c === counts[0]) && counts[0] >= 5;

  // Check if category distributions are identical
  let identicalCategoryDist = false;
  if (statements.length >= 2) {
    const getCategoryDist = (stmt: StatementDataset) => {
      const dist: Record<string, number> = {};
      for (const tx of stmt.transactions) {
        const cat = tx.category || 'uncategorized';
        dist[cat] = (dist[cat] || 0) + 1;
      }
      return JSON.stringify(Object.entries(dist).sort());
    };
    const dists = statements.map(getCategoryDist);
    identicalCategoryDist = dists.every(d => d === dists[0]);
  }

  if (allSame && identicalCategoryDist) {
    return {
      ruleId: 'EP-003',
      ruleCategory: 'entropy_pattern',
      ruleName: 'Templated Data Structure',
      description: `All ${statements.length} statement periods have identical transaction counts (${counts[0]}) and category distributions — consistent with template-generated data`,
      triggerCondition: 'Transaction count AND category distribution identical across all statement periods (≥ 2 periods, ≥ 5 txns each)',
      severity: 'high',
      confidenceImpact: -25,
      followUpAction: 'hard_review',
      auditLogEntry: `Templated data structure detected across ${statements.length} periods (${counts[0]} txns each, identical category split)`,
      metadata: { periodCount: statements.length, transactionsPerPeriod: counts[0] },
    };
  }
  return null;
}

// ─── Trust Degradation Logic ─────────────────────────────────────────────────

function applyTrustDegradation(findings: RuleFinding[], priorFindingsCount: number): { aggregateImpact: number; trustCeiling: number | null } {
  let aggregateImpact = 0;
  let trustCeiling: number | null = null;

  // Sum individual impacts with diminishing returns (compound anomalies are worse)
  const sortedByImpact = [...findings].sort((a, b) => a.confidenceImpact - b.confidenceImpact);

  for (let i = 0; i < sortedByImpact.length; i++) {
    const finding = sortedByImpact[i];
    // First finding = full impact; subsequent = 80% (compound penalty, not double counting)
    const multiplier = i === 0 ? 1 : 0.8;
    aggregateImpact += finding.confidenceImpact * multiplier;
  }

  // Compound anomaly escalation
  const highSeverityCount = findings.filter(f => f.severity === 'high').length;
  const mediumSeverityCount = findings.filter(f => f.severity === 'medium').length;
  const compoundCount = highSeverityCount + mediumSeverityCount;

  // 2+ high severity findings → hard cap at 55
  if (highSeverityCount >= 2) {
    trustCeiling = Math.min(trustCeiling ?? 100, 55);
  }

  // 3+ total medium/high findings → cap at 65
  if (compoundCount >= 3) {
    trustCeiling = Math.min(trustCeiling ?? 100, 65);
  }

  // Any hard_review action → cap at 70
  const hasHardReview = findings.some(f => f.followUpAction === 'hard_review');
  if (hasHardReview) {
    trustCeiling = Math.min(trustCeiling ?? 100, 70);
  }

  // Prior unresolved findings compound the ceiling
  if (priorFindingsCount > 5) {
    trustCeiling = Math.min(trustCeiling ?? 100, 60);
  }

  return { aggregateImpact, trustCeiling };
}

// ─── Main Engine Entry Point ─────────────────────────────────────────────────

export function evaluateDataConsistency(input: DataConsistencyInput): ConsistencyReport {
  const findings: RuleFinding[] = [];

  // 1. Arithmetic & Reconciliation
  if (input.statements) {
    for (const stmt of input.statements) {
      const balanceCheck = checkBalanceReconciliation(stmt);
      if (balanceCheck) findings.push(balanceCheck);

      const roundingCheck = checkRoundingAnomalies(stmt);
      if (roundingCheck) findings.push(roundingCheck);

      const balanceJump = checkBalanceJumps(stmt);
      if (balanceJump) findings.push(balanceJump);
    }
  }

  // 2. Temporal Logic
  if (input.statements && input.statements.length > 0) {
    const overlapCheck = checkOverlappingPeriods(input.statements);
    if (overlapCheck) findings.push(overlapCheck);

    for (const stmt of input.statements) {
      const outsideCheck = checkTransactionsOutsidePeriod(stmt);
      if (outsideCheck) findings.push(outsideCheck);

      const retroCheck = checkRetroactiveInsertion(stmt);
      if (retroCheck) findings.push(retroCheck);
    }
  }

  if (input.income) {
    const cadenceCheck = checkPayrollCadence(input.income);
    if (cadenceCheck) findings.push(cadenceCheck);
  }

  // 3. Behavioral & Sequence
  const earlyTrustCheck = checkEarlyHighTrustData(input);
  if (earlyTrustCheck) findings.push(earlyTrustCheck);

  const duplicateCheck = checkDuplicateDatasets(input);
  if (duplicateCheck) findings.push(duplicateCheck);

  if (input.statements && input.statements.length >= 2) {
    const identicalPatternCheck = checkIdenticalTransactionPatterns(input.statements);
    if (identicalPatternCheck) findings.push(identicalPatternCheck);

    const improbableCheck = checkImprobableConsistency(input.statements);
    if (improbableCheck) findings.push(improbableCheck);
  }

  // 4. Cross-Field Consistency
  if (input.statements && input.income) {
    const incomeInflowCheck = checkIncomeVsInflow(input.statements, input.income);
    if (incomeInflowCheck) findings.push(incomeInflowCheck);

    const employerCheck = checkEmployerConsistency(input.income, input.statements);
    if (employerCheck) findings.push(employerCheck);
  }

  // 5. Entropy & Pattern Analysis
  if (input.statements) {
    for (const stmt of input.statements) {
      const spacingCheck = checkTransactionSpacingEntropy(stmt);
      if (spacingCheck) findings.push(spacingCheck);

      const cleanCheck = checkOverlyCleanHistory(stmt);
      if (cleanCheck) findings.push(cleanCheck);
    }

    if (input.statements.length >= 2) {
      const templateCheck = checkTemplatedStructure(input.statements);
      if (templateCheck) findings.push(templateCheck);
    }
  }

  // 6. Trust Degradation
  const { aggregateImpact, trustCeiling } = applyTrustDegradation(
    findings,
    input.priorFindingsCount || 0
  );

  const compoundAnomalyCount = findings.filter(f => f.severity === 'high' || f.severity === 'medium').length;

  return {
    userId: input.userId,
    findings,
    aggregateConfidenceAdjustment: aggregateImpact,
    trustCeiling,
    compoundAnomalyCount,
    evaluatedAt: new Date().toISOString(),
  };
}
