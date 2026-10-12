// Output schemas mirroring the result interfaces in tools/*.ts.
// Used by registerTool so MCP clients can type-check tool responses.
// Each schema captures the key fields callers consume; runtime extras pass through.

import { z } from "zod";

export const findingSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]).describe("Triage priority: critical blocks AI citation, warning hurts probability, info is nice-to-have."),
  category: z
    .enum([
      "schema",
      "robots",
      "technical",
      "freshness",
      "structure",
      "authority",
      "presence",
      "sitemap",
      "llms_txt",
      "citation",
      "evidence",
      "trust",
      "entity",
      "content",
    ])
    .describe("Finding category - which AI-SEO dimension it relates to."),
  where: z.string().describe("Location of the issue (CSS selector, JSON-LD path, robots.txt line, or 'page-level')."),
  message: z.string().describe("Human-readable description of the issue."),
  fix: z.string().describe("Concrete, copy-pasteable fix."),
  estimated_impact: z.enum(["high", "medium", "low"]).optional().describe("Estimated impact on AI citation probability when resolved."),
  failure_signal: z.string().optional().describe("Falsifiability: the observable signal that would prove the fix did NOT work."),
  leading_indicator: z.string().optional().describe("Falsifiability: the leading indicator to monitor to confirm the fix is landing."),
});

export const gradeSchema = z.enum(["A", "B", "C", "D", "F"]).describe("Letter grade derived from the numeric score.");

export const auditPageOutputShape = {
  url: z.string().describe("The URL that was audited."),
  fetched_at: z.string().describe("UTC ISO-8601 timestamp of the fetch."),
  score: z.number().min(0).max(100).describe("Composite 0-100 AI-citation score."),
  grade: gradeSchema,
  findings: z.array(findingSchema).describe("All findings emitted by the sub-audits, deduplicated."),
  citation_verdict: z
    .object({
      will_ai_cite: z.enum(["unlikely", "marginal", "likely"]).describe("Coarse verdict from the composite score."),
      top_3_blockers: z
        .array(
          z.object({
            category: z.string(),
            message: z.string(),
            fix: z.string(),
            estimated_impact: z.enum(["high", "medium", "low"]).optional(),
          }),
        )
        .describe("Top three highest-impact issues blocking AI citation."),
      one_line_summary: z.string().describe("Single-sentence explanation suitable for headlines/dashboards."),
    })
    .describe("Prepended block summarizing whether AI assistants will cite this page and why."),
  dimension_scores: z
    .object({
      schema: z.number(),
      robots: z.number(),
      technical: z.number(),
      freshness: z.number(),
      structure: z.number(),
      authority: z.number(),
      entity_density: z.number(),
      sitemap: z.number(),
      citability: z.number().describe("Passage-level extractability: share of sections in the 134-167 word citable band."),
      evidence: z.number().describe("Citations / statistics / quotations density (Princeton GEO weighting)."),
      trust: z.number().describe("E-E-A-T trust signals: author, dates, contact/policy pages, HTTPS."),
    })
    .describe("Per-dimension 0-100 subscores. The composite score is a weighted blend of these."),
  platform_readiness: z
    .object({
      chatgpt: z.object({ score: z.number(), label: z.enum(["ready", "partial", "weak"]) }),
      perplexity: z.object({ score: z.number(), label: z.enum(["ready", "partial", "weak"]) }),
      google_ai_overview: z.object({ score: z.number(), label: z.enum(["ready", "partial", "weak"]) }),
      gemini: z.object({ score: z.number(), label: z.enum(["ready", "partial", "weak"]) }),
    })
    .describe("Per-engine readiness derived from the dimensions; engines reward different signals."),
  score_caps: z
    .array(z.string())
    .describe("Hard blockers that capped the composite score (e.g. noindex, AI bots blocked). Empty when none fired."),
  content_quality: z
    .enum(["static_html", "ssr_likely", "spa_empty"])
    .describe("Classification of the fetched HTML's readiness. spa_empty means audit results are degraded."),
  raw_html: z.string().optional().describe("Full raw HTML response. Present only when include_raw_html=true."),
  report_html: z.string().optional().describe("Self-contained HTML scorecard. Present only when generate_report=true."),
} as const;

export const crawlerStatusSchema = z.object({
  allowed: z.boolean().describe("Whether this crawler is allowed to fetch the site root."),
  match_source: z.string().optional().describe("The robots.txt rule line that produced this verdict, if any."),
});

export const checkRobotsOutputShape = {
  robots_url: z.string().describe("The robots.txt URL that was fetched."),
  fetched_at: z.string().describe("UTC ISO-8601 timestamp of the fetch."),
  training_crawlers: z.record(z.string(), crawlerStatusSchema).describe("Allow/disallow posture per known AI training crawler (GPTBot, ClaudeBot, CCBot, etc.)."),
  search_crawlers: z.record(z.string(), crawlerStatusSchema).describe("Allow/disallow posture per known AI search crawler (OAI-SearchBot, PerplexityBot, etc.)."),
  user_triggered: z.record(z.string(), crawlerStatusSchema).describe("Allow/disallow posture per user-triggered fetcher (ChatGPT-User, Claude-User, etc.)."),
  findings: z.array(findingSchema).describe("Per-crawler findings explaining why the posture matters."),
  recommended_posture: z
    .enum(["block_training_allow_search", "allow_all", "block_all", "custom"])
    .describe("Suggested posture given the current rules."),
} as const;

export const checkSitemapOutputShape = {
  sitemap_url: z.union([z.null(), z.string()]),
  status: z.enum(["found","missing","error"]),
  total_urls: z.number(),
  urls_with_lastmod: z.number(),
  stale_urls: z.number(),
  has_image_sitemap: z.boolean(),
  has_video_sitemap: z.boolean(),
  sitemap_index: z.boolean(),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

export const checkTechnicalOutputShape = {
  url: z.string(),
  https: z.boolean(),
  canonical: z.object({"present": z.boolean(), "value": z.union([z.null(), z.string()]), "self_referential": z.boolean(), "cross_domain": z.boolean()}),
  noindex: z.boolean(),
  noindex_header: z.boolean(),
  og_tags: z.object({"title": z.boolean(), "description": z.boolean(), "image": z.boolean(), "url": z.boolean(), "type": z.boolean()}),
  twitter_card: z.object({"present": z.boolean(), "card_type": z.union([z.null(), z.string()])}),
  hreflang: z.object({"present": z.boolean(), "count": z.number(), "x_default": z.boolean()}),
  title_og_match: z.boolean(),
  meta_description: z.object({"present": z.boolean(), "length": z.number()}),
  response_headers: z.object({"hsts": z.union([z.null(), z.string()]), "x_content_type_options": z.union([z.null(), z.string()]), "referrer_policy": z.union([z.null(), z.string()]), "content_security_policy": z.union([z.null(), z.string()]), "cache_control": z.union([z.null(), z.string()])}),
  mixed_content: z.object({"count": z.number(), "samples": z.array(z.string())}),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

export const auditSchemaOutputShape = {
  source: z.enum(["url","inline"]),
  found_types: z.array(z.string()),
  missing_priority_types: z.array(z.string()),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
  ai_citation_readiness_score: z.number().min(0).max(100),
} as const;

export const auditCanonicalOutputShape = {
  url: z.string(),
  final_url: z.string(),
  canonical_value: z.union([z.null(), z.string()]),
  is_self_referential: z.boolean(),
  is_cross_domain: z.boolean(),
  trailing_slash_consistent: z.boolean(),
  canonical_og_url_match: z.boolean(),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

export const scoreAiOverviewOutputShape = {
  url: z.string(),
  overall_eligibility_score: z.number(),
  factors: z.object({"semantic_completeness": z.number(), "structured_data": z.number(), "eeat_signals": z.number(), "entity_density": z.number(), "content_freshness": z.number(), "passage_structure": z.number(), "multimodal_content": z.number()}),
  top_improvements: z.array(z.object({"action": z.string(), "estimated_score_gain": z.number()})),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

export const scoreCitationOutputShape = {
  overall_score: z.number(),
  engine_scores: z.object({"perplexity": z.number(), "chatgpt": z.number(), "google_ai_overviews": z.number(), "claude": z.number()}),
  sub_scores: z.object({"bluf_present": z.boolean(), "faq_blocks": z.number(), "statistic_density": z.number(), "entity_clarity": z.number(), "heading_question_ratio": z.number(), "answer_completeness": z.number()}),
  extractability_score: z.number(),
  chunk_analysis: z.array(z.object({"heading": z.string(), "level": z.number(), "word_count": z.number(), "score": z.number(), "issues": z.array(z.string())})),
  most_extractable: z.union([z.null(), z.object({"heading": z.string(), "score": z.number()})]),
  least_extractable: z.union([z.null(), z.object({"heading": z.string(), "score": z.number()})]),
  improvements: z.array(z.string()),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

const agenticFactorSchema = z.object({
  score: z.number().min(0).max(100).describe("0-100 subscore for this signal."),
  detail: z.string().describe("One-line description of what was measured."),
});

export const scoreAgenticBrowsingOutputShape = {
  url: z.string().nullable().describe("The URL scored (null when scoring raw html)."),
  fetched_at: z.string().describe("UTC ISO-8601 timestamp."),
  score: z.number().min(0).max(100).describe("Weighted 0-100 Agentic Browsing score (accessibility 40%, layout 35%, webmcp 15%, llms.txt 10%)."),
  grade: gradeSchema,
  factors: z
    .object({
      llms_txt: agenticFactorSchema,
      webmcp: agenticFactorSchema,
      accessibility_tree: agenticFactorSchema,
      layout_stability: agenticFactorSchema,
    })
    .describe("The four Lighthouse Agentic Browsing signals, scored 0-100 each."),
  findings: z.array(findingSchema),
} as const;

export const generateLlmsTxtOutputShape = {
  domain: z.string(),
  llms_txt: z.string().describe("The generated llms.txt file content. Caller is responsible for hosting it."),
  llms_full_txt: z.string().nullable().optional().describe("The generated llms-full.txt content. Null unless include_full=true."),
  pages_indexed: z.number().describe("Number of pages successfully sampled from the sitemap."),
} as const;

export const generatePricingMdOutputShape = {
  domain: z.string(),
  pricing_md: z.string().describe("The generated pricing.md content. Caller hosts it at /pricing.md."),
  source_url: z.string().nullable().describe("The pricing page the content was derived from (null when none was found)."),
  tiers_detected: z.number().describe("Number of pricing tiers extracted."),
  validation_issues: z.array(findingSchema).describe("Issues encountered while deriving the file."),
  suggested_path: z.literal("/pricing.md"),
} as const;

export const validateLlmsTxtOutputShape = {
  valid: z.boolean(),
  links_total: z.number(),
  links_broken: z.number(),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
} as const;

export const rewriteOutputShape = {
  rewritten_text: z.string(),
  schema_additions: z.string(),
  changes_made: z.array(z.string()),
  before_score: z.number(),
  after_score: z.number(),
  mode: z.enum(["sampling","prompt_template"]),
} as const;

export const extractEntitiesOutputShape = {
  entities: z.array(z.object({"name": z.string(), "type": z.union([z.null(), z.string()]), "same_as": z.array(z.string()), "mention_count": z.number(), "is_defined": z.boolean()})),
  entity_count: z.number(),
  connected_entity_count: z.number(),
  citation_density_score: z.number(),
  findings: z.array(z.object({"severity": z.enum(["critical","warning","info"]), "category": z.enum(["schema","robots","technical","freshness","structure","authority","presence","sitemap","llms_txt","citation","evidence","trust","entity","content"]), "where": z.string(), "message": z.string(), "fix": z.string(), "estimated_impact": z.union([z.undefined(), z.literal("high"), z.literal("medium"), z.literal("low")]).optional(), "failure_signal": z.union([z.undefined(), z.string()]).optional(), "leading_indicator": z.union([z.undefined(), z.string()]).optional()})),
  mode: z.enum(["sampling","regex_fallback"]),
} as const;

export const diffPagesOutputShape = {
  url_a: z.string(),
  url_b: z.string(),
  query: z.string().nullable(),
  better_for_citation: z.enum(["a", "b", "tie"]),
  scores: z.object({ a: z.number(), b: z.number() }),
  delta: z.record(
    z.string(),
    z.object({
      a: z.number(),
      b: z.number(),
      advantage: z.enum(["a", "b", "tie"]),
    }),
  ),
  missing_in_a: z.array(z.string()),
  missing_in_b: z.array(z.string()),
  fix_recommendations_for_a: z.array(z.object({ category: z.string(), message: z.string(), fix: z.string() })),
} as const;

export const auditSiteOutputShape = {
  domain: z.string(),
  homepage_url: z.string(),
  fetched_at: z.string(),
  overall_score: z.number().min(0).max(100),
  overall_grade: gradeSchema,
  top_5_fixes: z.array(findingSchema).describe("Up to five highest-impact findings across all sub-audits."),
  parts: z
    .object({
      audit_page: z.record(z.string(), z.unknown()).describe("Result of the homepage audit (or { error } on failure)."),
      check_robots: z.record(z.string(), z.unknown()),
      check_sitemap: z.record(z.string(), z.unknown()),
      audit_schema: z.record(z.string(), z.unknown()),
    })
    .describe("Raw sub-audit results, for callers who want to drill in."),
} as const;

export const saveReportOutputShape = {
  saved_to: z.string().describe("Absolute path of the file that was written."),
  bytes_written: z.number(),
  format: z.enum(["audit_page", "audit_site"]).describe("Which input shape the report was rendered for."),
} as const;

export const testCitationOutputShape = {
  target_query: z.string().describe("The query the engine simulation answered."),
  engine: z.enum(["chatgpt", "claude", "perplexity", "google_ai_overviews", "any"]).describe("Which engine persona produced the verdict."),
  would_cite: z.boolean().describe("Binary verdict: would the simulated engine cite this page for the query?"),
  confidence: z.number().min(0).max(100).describe("How likely a real engine is to surface this page (0-100)."),
  citation_excerpt: z.string().nullable().describe("If would_cite=true, the 20-60 word verbatim excerpt the engine would surface; otherwise null."),
  reasoning: z.string().describe("Plain-language explanation of the verdict."),
  blocking_issues: z.array(z.string()).describe("Concrete reasons the page is (or is not) citable. Empty if would_cite=true and excerpt is clearly attributable."),
  improvements: z.array(
    z.object({
      change: z.string().describe("Specific edit the author should make."),
      estimated_impact: z.enum(["high", "medium", "low"]).describe("Estimated impact of this change on citation probability."),
    }),
  ).describe("Ranked, specific edits to improve citation probability."),
  mode: z.enum(["sampling", "static_heuristic"]).describe("Which code path produced the result: MCP sampling (host LLM) or deterministic heuristic fallback."),
} as const;

export const auditSitemapOutputShape = {
  domain: z.string().describe("The domain audited."),
  sitemap_url: z.string().nullable().describe("Resolved sitemap URL (null when discovery failed)."),
  total_urls_in_sitemap: z.number().describe("Total URLs declared across the sitemap and any indexed children."),
  urls_sampled: z.number().describe("Number of URLs picked via uniform-stride sampling."),
  sampling: z.literal("uniform_stride").describe("Sampling strategy. Deterministic uniform stride: every Nth URL is picked."),
  audited: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      grade: gradeSchema,
      top_issue: z.string().nullable(),
    }),
  ).describe("Per-page audit results that completed successfully."),
  failed: z.array(z.object({ url: z.string(), error: z.string() })).describe("URLs whose audit failed, with the error message."),
  score_distribution: z.object({
    avg: z.number(),
    median: z.number(),
    min: z.number(),
    max: z.number(),
    p25: z.number(),
    p75: z.number(),
  }).describe("Summary statistics across the audited sample."),
  grade_distribution: z.object({ A: z.number(), B: z.number(), C: z.number(), D: z.number(), F: z.number() }).describe("Count of pages per letter grade."),
  worst_pages: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      grade: gradeSchema,
      top_issue: z.string().nullable(),
    }),
  ).describe("Lowest-scoring pages from the sample, worst first."),
  top_findings: z.array(
    z.object({
      message: z.string(),
      category: z.string(),
      severity: z.enum(["critical", "warning", "info"]),
      count: z.number().describe("How many pages in the sample had this finding."),
      fix: z.string(),
    }),
  ).describe("Most-common findings across all sampled pages, sorted by occurrence count desc."),
  fetched_at: z.string().describe("UTC ISO-8601 timestamp of the audit."),
} as const;
