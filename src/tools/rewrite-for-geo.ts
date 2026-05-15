// Tool: rewrite_for_geo
// Rewrites content for Generative Engine Optimization (entity-rich, synthesis-ready structure).

import { z } from "zod";
import { politeFetch, type HostDelayMap } from "../lib/fetch.js";
import { parseBody } from "../lib/html.js";
import { scoreCitationWorthiness } from "./score-citation-worthiness.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const rewriteForGeoInputSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string(),
    add_comparison_table: z.boolean().optional().default(false),
    max_words: z.number().int().min(100).max(5000).optional().default(1500),
    respect_robots: z.boolean().optional().default(true),
  })
  .refine((d) => d.url !== undefined || d.text !== undefined, {
    message: "One of url or text is required",
  });

export type RewriteForGeoInput = z.infer<typeof rewriteForGeoInputSchema>;

export interface RewriteGeoResult {
  rewritten_text: string;
  schema_additions: string;
  changes_made: string[];
  before_score: number;
  after_score: number;
  entities_added: string[];
  mode: "sampling" | "prompt_template";
}

const GEO_SYSTEM_PROMPT = `You are a Generative Engine Optimization (GEO) specialist focused on Google AI Overviews and multi-source synthesis engines.

Rules:
1. Define every key entity inline on first mention: "X (also known as Y) is a type of Z that...".
2. Include authoritative external citations with hyperlinks (Wikipedia, official docs, research papers).
3. Add a comparison table if requested or if the query implies comparison.
4. Use numbered feature lists for technical capabilities.
5. Structure for multi-source synthesis: each section should be independently citable without reading the full article.
6. Cite statistics with source, year, and context.
7. Add a "Related entities" section at the end listing key entities with sameAs links.
8. No em-dashes. No filler phrases.
9. Keep within the max_words limit.

Generate JSON-LD schema for all key entities mentioned (Organization, Person, Product, SoftwareApplication as appropriate) with sameAs links.`;

export async function rewriteForGeo(
  input: RewriteForGeoInput,
  hostDelays?: HostDelayMap,
  robotsCache?: Map<string, string>,
  server?: McpServer
): Promise<RewriteGeoResult> {
  let originalText = input.text ?? "";
  if (input.url) {
    const result = await politeFetch(input.url, {
      respectRobots: input.respect_robots,
      hostDelays,
      robotsCache,
    });
    const body = parseBody(result.body, input.url);
    originalText = body.bodyText.substring(0, 8000);
  }

  const beforeResult = await scoreCitationWorthiness(
    { text: originalText, target_query: input.target_query, respect_robots: false },
    hostDelays,
    robotsCache
  );
  const before_score = beforeResult.overall_score;

  const userMessage = `Target query: "${input.target_query}"
Add comparison table: ${input.add_comparison_table}
Max words: ${input.max_words}

Original content:
---
${originalText.substring(0, 4000)}
---

Rewrite this content for GEO. Return JSON with:
- rewritten_text: Markdown content
- schema_additions: JSON-LD for key entities
- changes_made: array of changes applied
- entities_added: array of entity names you defined or linked`;

  if (server) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - sampling API availability varies by client
      const samplingResult = await server.server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [{ role: "user", content: { type: "text", text: userMessage } }],
            systemPrompt: GEO_SYSTEM_PROMPT,
            maxTokens: 4096,
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any
      );
      const text =
        samplingResult?.content?.text ?? samplingResult?.content?.[0]?.text ?? "";
      if (text) {
        try {
          const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) ?? text.match(/\{[\s\S]+\}/);
          const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text;
          const parsed = JSON.parse(jsonStr) as {
            rewritten_text: string;
            schema_additions: string;
            changes_made: string[];
            entities_added: string[];
          };

          const afterResult = await scoreCitationWorthiness(
            { text: parsed.rewritten_text, target_query: input.target_query, respect_robots: false },
            hostDelays,
            robotsCache
          );

          return {
            rewritten_text: parsed.rewritten_text,
            schema_additions: parsed.schema_additions,
            changes_made: parsed.changes_made ?? [],
            before_score,
            after_score: afterResult.overall_score,
            entities_added: parsed.entities_added ?? [],
            mode: "sampling",
          };
        } catch {
          // fall through to prompt template
        }
      }
    } catch {
      // sampling unavailable
    }
  }

  const promptTemplate = `${GEO_SYSTEM_PROMPT}

${userMessage}`;

  return {
    rewritten_text: promptTemplate,
    schema_additions: "",
    changes_made: [
      "sampling/createMessage unavailable - returned prompt template for manual use",
    ],
    before_score,
    after_score: before_score,
    entities_added: [],
    mode: "prompt_template",
  };
}
