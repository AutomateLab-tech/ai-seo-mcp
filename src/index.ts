#!/usr/bin/env node
// AI-SEO MCP Server - entrypoint.
// All logging goes to stderr. stdout is reserved for JSON-RPC transport.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { auditPage, auditPageInputSchema } from "./tools/audit-page.js";
import { auditSchema, auditSchemaInputSchema } from "./tools/audit-schema.js";
import { auditCanonical, auditCanonicalInputSchema } from "./tools/audit-canonical.js";
import { checkRobots, checkRobotsInputSchema } from "./tools/check-robots.js";
import { checkSitemap, checkSitemapInputSchema } from "./tools/check-sitemap.js";
import { checkTechnical, checkTechnicalInputSchema } from "./tools/check-technical.js";
import { scoreAiOverviewEligibility, scoreAiOverviewEligibilityInputSchema } from "./tools/score-ai-overview-eligibility.js";
import { generateLlmsTxtTool, generateLlmsTxtInputSchema } from "./tools/generate-llms-txt.js";
import { validateLlmsTxt, validateLlmsTxtInputSchema } from "./tools/validate-llms-txt.js";
import { scoreCitationWorthiness, scoreCitationWorthinessInputSchema } from "./tools/score-citation-worthiness.js";
import { rewriteForAeo, rewriteForAeoInputSchema } from "./tools/rewrite-for-aeo.js";
import { rewriteForGeo, rewriteForGeoInputSchema } from "./tools/rewrite-for-geo.js";
import { extractEntities, extractEntitiesInputSchema } from "./tools/extract-entities.js";
import type { ToolError } from "./types.js";
import { ToolFetchError } from "./lib/fetch.js";

const server = new McpServer({
  name: "@automatelab/ai-seo-mcp",
  version: "0.1.0",
});

/** Serialize a ToolError to MCP error content. */
function toolError(err: ToolError): { content: [{ type: "text"; text: string }]; isError: true } {
  return {
    content: [{ type: "text", text: JSON.stringify(err, null, 2) }],
    isError: true,
  };
}

type ToolResponse = { content: [{ type: "text"; text: string }]; isError?: boolean };

/** Wrap a tool handler to catch errors and return structured ToolError responses. */
function wrapHandler<T>(handler: () => Promise<T>): Promise<ToolResponse> {
  return handler()
    .then((result): ToolResponse => ({
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }))
    .catch((err: unknown): ToolResponse => {
      if (err instanceof ToolFetchError) {
        return toolError(err.toolError);
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[error]", message);
      return toolError({ type: "fetch_error", url: "", message });
    });
}

// --- Tool 1: audit_page ---
server.tool(
  "audit_page",
  "Run a full AI-SEO audit on a single URL and return categorized findings with severity, fix instructions, and a 0-100 score.",
  auditPageInputSchema.shape,
  async (input) => wrapHandler(() => auditPage(input))
);

// --- Tool 2: audit_schema ---
server.tool(
  "audit_schema",
  "Validate JSON-LD structured data on a URL or raw JSON string against Schema.org rules and AI-citation best practices.",
  {
    url: z.string().url().optional(),
    schema_json: z.string().optional(),
    respect_robots: z.boolean().optional().default(true),
  },
  async (input) => {
    // Manual refinement check (zod .refine not supported in tool shape directly)
    if (!input.url && !input.schema_json) {
      return toolError({ type: "invalid_url", message: "One of url or schema_json is required" });
    }
    return wrapHandler(() => auditSchema(input as Parameters<typeof auditSchema>[0]));
  }
);

// --- Tool 3: audit_canonical ---
server.tool(
  "audit_canonical",
  "Audit canonical link integrity, trailing-slash hygiene, self-referencing, and og:url consistency.",
  auditCanonicalInputSchema.shape,
  async (input) => wrapHandler(() => auditCanonical(input))
);

// --- Tool 4: check_robots ---
server.tool(
  "check_robots",
  "Parse a domain's robots.txt and report per-crawler allow/disallow posture for all known AI crawlers.",
  checkRobotsInputSchema.shape,
  async (input) => wrapHandler(() => checkRobots(input))
);

// --- Tool 5: check_sitemap ---
server.tool(
  "check_sitemap",
  "Validate a domain's XML sitemap for presence, accessibility, URL count, lastmod freshness, and AI-search attributes.",
  checkSitemapInputSchema.shape,
  async (input) => wrapHandler(() => checkSitemap(input))
);

// --- Tool 6: check_technical ---
server.tool(
  "check_technical",
  "Audit a page's HEAD for canonical, OpenGraph, Twitter Card, hreflang, HTTPS, noindex, and title hygiene.",
  checkTechnicalInputSchema.shape,
  async (input) => wrapHandler(() => checkTechnical(input))
);

// --- Tool 7: score_ai_overview_eligibility ---
server.tool(
  "score_ai_overview_eligibility",
  "Score a page's probability of appearing in Google AI Overviews using published 2025-2026 correlation factors.",
  scoreAiOverviewEligibilityInputSchema.shape,
  async (input) => wrapHandler(() => scoreAiOverviewEligibility(input))
);

// --- Tool 8: generate_llms_txt ---
server.tool(
  "generate_llms_txt",
  "Generate a valid llms.txt (and optionally llms-full.txt) for a domain from its sitemap.",
  generateLlmsTxtInputSchema.shape,
  async (input) => wrapHandler(() => generateLlmsTxtTool(input))
);

// --- Tool 9: validate_llms_txt ---
server.tool(
  "validate_llms_txt",
  "Validate an existing llms.txt or llms-full.txt against the spec, checking structure and broken links.",
  {
    url: z.string().url().optional(),
    content: z.string().optional(),
    check_links: z.boolean().optional().default(true),
  },
  async (input) => {
    if (!input.url && !input.content) {
      return toolError({ type: "invalid_url", message: "One of url or content is required" });
    }
    return wrapHandler(() => validateLlmsTxt(input as Parameters<typeof validateLlmsTxt>[0]));
  }
);

// --- Tool 10: score_citation_worthiness ---
server.tool(
  "score_citation_worthiness",
  "Score how citable a page or text block is for AI engines: BLUF, FAQ patterns, statistic density, entity clarity.",
  {
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string().optional(),
    respect_robots: z.boolean().optional().default(true),
  },
  async (input) => {
    if (!input.url && !input.text) {
      return toolError({ type: "invalid_url", message: "One of url or text is required" });
    }
    return wrapHandler(() => scoreCitationWorthiness(input as Parameters<typeof scoreCitationWorthiness>[0]));
  }
);

// --- Tool 11: rewrite_for_aeo ---
server.tool(
  "rewrite_for_aeo",
  "Rewrite a content block for Answer Engine Optimization - adds BLUF opening, FAQ structure, and schema additions.",
  {
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string(),
    format: z.enum(["article", "faq", "howto", "comparison"]).default("article"),
    max_words: z.number().int().min(100).max(5000).optional().default(1500),
    respect_robots: z.boolean().optional().default(true),
  },
  async (input) => {
    if (!input.url && !input.text) {
      return toolError({ type: "invalid_url", message: "One of url or text is required" });
    }
    return wrapHandler(() =>
      rewriteForAeo(input as Parameters<typeof rewriteForAeo>[0], undefined, undefined, server)
    );
  }
);

// --- Tool 12: rewrite_for_geo ---
server.tool(
  "rewrite_for_geo",
  "Rewrite a content block for Generative Engine Optimization - entity-rich, comparison-ready, synthesis-friendly.",
  {
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string(),
    add_comparison_table: z.boolean().optional().default(false),
    max_words: z.number().int().min(100).max(5000).optional().default(1500),
    respect_robots: z.boolean().optional().default(true),
  },
  async (input) => {
    if (!input.url && !input.text) {
      return toolError({ type: "invalid_url", message: "One of url or text is required" });
    }
    return wrapHandler(() =>
      rewriteForGeo(input as Parameters<typeof rewriteForGeo>[0], undefined, undefined, server)
    );
  }
);

// --- Tool 13: extract_entities ---
server.tool(
  "extract_entities",
  "Extract named entities, linked concepts, and sameAs graph nodes from a page's content and structured data.",
  {
    url: z.string().url().optional(),
    text: z.string().optional(),
    respect_robots: z.boolean().optional().default(true),
  },
  async (input) => {
    if (!input.url && !input.text) {
      return toolError({ type: "invalid_url", message: "One of url or text is required" });
    }
    return wrapHandler(() => extractEntities(input as Parameters<typeof extractEntities>[0]));
  }
);

// --- Start server ---
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ai-seo-mcp] Server started on stdio transport");
}

main().catch((err: unknown) => {
  console.error("[ai-seo-mcp] Fatal error:", err);
  process.exit(1);
});
