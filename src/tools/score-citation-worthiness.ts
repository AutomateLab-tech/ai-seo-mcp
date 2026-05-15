// Tool: score_citation_worthiness
// Scores how citable a page or text block is for AI engines.

import { z } from "zod";
import { politeFetch, type HostDelayMap } from "../lib/fetch.js";
import { parseBody, parseHead } from "../lib/html.js";
import { parseJsonLd, getAllSchemaTypes } from "../lib/schema.js";
import type { Finding } from "../types.js";

export const scoreCitationWorthinessInputSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string().optional(),
    respect_robots: z.boolean().optional().default(true),
  })
  .refine((d) => d.url !== undefined || d.text !== undefined, {
    message: "One of url or text is required",
  });

export type ScoreCitationWorthinessInput = z.infer<typeof scoreCitationWorthinessInputSchema>;

export interface CitationWorthinessResult {
  overall_score: number;
  engine_scores: {
    perplexity: number;
    chatgpt: number;
    google_ai_overviews: number;
    claude: number;
  };
  sub_scores: {
    bluf_present: boolean;
    faq_blocks: number;
    statistic_density: number;
    entity_clarity: number;
    heading_question_ratio: number;
    answer_completeness: number;
  };
  improvements: string[];
  findings: Finding[];
}

function computeBluf(bodyText: string, targetQuery?: string): boolean {
  const first100Words = bodyText.split(/\s+/).slice(0, 100).join(" ");
  // Direct answer heuristic: a sentence with a number, or containing the target query
  if (targetQuery && first100Words.toLowerCase().includes(targetQuery.toLowerCase())) return true;
  if (/\b\d+\b/.test(first100Words) && /\.\s/.test(first100Words)) return true;
  return false;
}

function computeStatisticDensity(bodyText: string): number {
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount === 0) return 0;
  const statMatches = bodyText.match(/\b\d[\d,.'%]+\b/g) ?? [];
  const statsPerThousand = (statMatches.length / wordCount) * 1000;
  return Math.min(100, Math.round(statsPerThousand * 10)); // >10 stats/1000 words = 100
}

function computeEntityClarity(bodyText: string): number {
  const definitionPatterns = /\b\w+\s+(is an?\s+|refers to\s+|means\s+|defined as\s+)/gi;
  const definitions = (bodyText.match(definitionPatterns) ?? []).length;
  const uniqueNouns = new Set(bodyText.match(/\b[A-Z][a-z]+\b/g) ?? []).size;
  if (uniqueNouns === 0) return 0;
  return Math.min(100, Math.round((definitions / Math.max(1, uniqueNouns)) * 100 * 10));
}

function countFaqBlocks(h3s: string[], paragraphs: string[]): number {
  // FAQ block = H3 ending in "?" followed by a paragraph
  return h3s.filter((h) => h.endsWith("?")).length;
}

export async function scoreCitationWorthiness(
  input: ScoreCitationWorthinessInput,
  hostDelays?: HostDelayMap,
  robotsCache?: Map<string, string>
): Promise<CitationWorthinessResult> {
  const findings: Finding[] = [];
  let bodyText = "";
  let h3s: string[] = [];
  let paragraphs: string[] = [];
  let hasStructuredData = false;
  let wordCount = 0;

  if (input.url) {
    const result = await politeFetch(input.url, {
      respectRobots: input.respect_robots,
      hostDelays,
      robotsCache,
    });
    const body = parseBody(result.body, input.url);
    bodyText = body.bodyText;
    h3s = body.h3s;
    paragraphs = body.paragraphs;
    wordCount = body.wordCount;
    const jsonLdBlocks = parseJsonLd(result.body);
    const foundTypes = getAllSchemaTypes(jsonLdBlocks);
    hasStructuredData = foundTypes.length > 0;
  } else {
    bodyText = input.text!;
    wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    // Extract H3-like lines from plain text (lines ending in ?)
    const lines = bodyText.split("\n");
    h3s = lines.filter((l) => l.trim().endsWith("?") && l.trim().length < 100);
    paragraphs = lines.filter((l) => l.trim().split(/\s+/).length >= 20);
  }

  // Sub-scores
  const bluf_present = computeBluf(bodyText, input.target_query);
  const faq_blocks = countFaqBlocks(h3s, paragraphs);
  const statistic_density = computeStatisticDensity(bodyText);
  const entity_clarity = computeEntityClarity(bodyText);

  const totalHeadings = h3s.length + (input.text ? 0 : 0); // simplified
  const questionHeadings = h3s.filter((h) => h.endsWith("?")).length;
  const heading_question_ratio =
    totalHeadings > 0 ? Math.round((questionHeadings / totalHeadings) * 100) : 0;

  // Longest self-contained paragraph (word count proxy)
  const answer_completeness =
    paragraphs.length > 0
      ? Math.min(
          100,
          Math.max(...paragraphs.map((p) => p.split(/\s+/).filter((w) => w.length > 0).length)) / 2
        )
      : 0;

  // Engine-specific scores
  const blufScore = bluf_present ? 100 : 0;
  const faqScore = Math.min(100, faq_blocks * 25);
  const structuredDataScore = hasStructuredData ? 80 : 0;

  // Perplexity: faq_blocks 40%, bluf_present 30%, statistic_density 30%
  const perplexity = Math.round(
    faqScore * 0.4 + blufScore * 0.3 + statistic_density * 0.3
  );

  // ChatGPT: answer_completeness 35%, structured_data 35%, bluf_present 30%
  const chatgpt = Math.round(
    answer_completeness * 0.35 + structuredDataScore * 0.35 + blufScore * 0.3
  );

  // Google AI Overviews: faq_blocks 30%, entity_clarity 30%, heading_question_ratio 20%, statistic_density 20%
  const google_ai_overviews = Math.round(
    faqScore * 0.3 +
    entity_clarity * 0.3 +
    heading_question_ratio * 0.2 +
    statistic_density * 0.2
  );

  // Claude: statistic_density 35%, bluf_present 35%, entity_clarity 30%
  const claude = Math.round(
    statistic_density * 0.35 + blufScore * 0.35 + entity_clarity * 0.30
  );

  const overall_score = Math.round((perplexity + chatgpt + google_ai_overviews + claude) / 4);

  // Improvements
  const improvements: string[] = [];
  if (!bluf_present) {
    improvements.push("Add a direct 40-60 word answer in the first paragraph (BLUF - Bottom Line Up Front).");
  }
  if (faq_blocks < 3) {
    improvements.push("Structure 3-5 FAQ-formatted Q&A blocks with H3 headings ending in '?'.");
  }
  if (statistic_density < 30) {
    improvements.push("Include at least 3 cited statistics with year and source to increase statistic density.");
  }
  if (entity_clarity < 20) {
    improvements.push("Define key terms inline (e.g., 'X is a type of Y that...') to improve entity clarity.");
  }
  const topImprovements = improvements.slice(0, 3);

  // Findings
  if (overall_score < 40) {
    findings.push({
      severity: "warning",
      category: "structure",
      where: "page-level",
      message: `Low citation worthiness score (${overall_score}/100).`,
      fix: "Apply BLUF structure, add FAQ blocks, and include cited statistics.",
      estimated_impact: "high",
    });
  }

  return {
    overall_score,
    engine_scores: { perplexity, chatgpt, google_ai_overviews, claude },
    sub_scores: {
      bluf_present,
      faq_blocks,
      statistic_density,
      entity_clarity,
      heading_question_ratio,
      answer_completeness,
    },
    improvements: topImprovements,
    findings,
  };
}
