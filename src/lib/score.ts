// Grade derivation and dimension weighting formulas.

import type { Finding } from "../types.js";

export type Grade = "A" | "B" | "C" | "D" | "F";

/** Derive a letter grade from a 0-100 numeric score. */
export function deriveGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

/**
 * Weighted dimension score for audit_page.
 * Weights: schema 25%, technical 20%, structure 20%, robots 10%,
 *          freshness 10%, authority 10%, entity_density 3%, sitemap 2%.
 */
export function computeWeightedScore(dimensions: {
  schema: number;
  technical: number;
  structure: number;
  robots: number;
  freshness: number;
  authority: number;
  entity_density: number;
  sitemap: number;
}): number {
  const score =
    dimensions.schema * 0.25 +
    dimensions.technical * 0.2 +
    dimensions.structure * 0.2 +
    dimensions.robots * 0.1 +
    dimensions.freshness * 0.1 +
    dimensions.authority * 0.1 +
    dimensions.entity_density * 0.03 +
    dimensions.sitemap * 0.02;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Compute a simple score from a findings list.
 * Starts at 100, deducts per finding severity.
 * critical: -15, warning: -7, info: -2
 */
export function scoreFromFindings(
  findings: Finding[],
  baseScore = 100,
  weights = { critical: 15, warning: 7, info: 2 }
): number {
  let score = baseScore;
  for (const f of findings) {
    if (f.severity === "critical") score -= weights.critical;
    else if (f.severity === "warning") score -= weights.warning;
    else score -= weights.info;
  }
  return Math.max(0, Math.min(100, score));
}

/** Freshness score from a dateModified ISO string. 100 if within 90 days, decays linearly to 0 at 365 days. */
export function freshnessScore(dateModified: string | null): number {
  if (!dateModified) return 30; // unknown freshness - partial credit
  const modified = new Date(dateModified).getTime();
  const now = Date.now();
  const ageMs = now - modified;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 90) return 100;
  if (ageDays >= 365) return 0;
  // linear decay from 100 at 90 days to 0 at 365 days
  return Math.round(100 * (1 - (ageDays - 90) / (365 - 90)));
}
