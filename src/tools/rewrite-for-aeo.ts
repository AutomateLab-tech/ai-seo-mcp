// Tool: rewrite_for_aeo
// Rewrites content for Answer Engine Optimization via MCP sampling.
// Falls back to returning a structured prompt template if sampling is unavailable.

import { z } from "zod";
import { politeFetch, type HostDelayMap } from "../lib/fetch.js";
import { parseBody } from "../lib/html.js";
import { scoreCitationWorthiness } from "./score-citation-worthiness.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const rewriteForAeoInputSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().optional(),
    target_query: z.string(),
    format: z.enum(["article", "faq", "howto", "comparison"]).default("article"),
    max_words: z.number().int().min(100).max(5000).optional().default(1500),
    respect_robots: z.boolean().optional().default(true),
  })
  .refine((d) => d.url !== undefined || d.text !== undefined, {
    message: "One of url or text is required",
  });

export type RewriteForAeoInput = z.infer<typeof rewriteForAeoInputSchema>;

export interface RewriteAeoResult {
  rewritten_text: string;
  schema_additions: string;
  changes_made: string[];
  before_score: number;
  after_score: number;
  mode: "sampling" | "prompt_template";
}

const AEO_SYSTEM_PROMPT = `You are an Answer Engine Optimization (AEO) specialist. Rewrite the provided content to maximize AI engine citation probability.

Rules:
1. Open with a direct 40-60 word answer to the target query (BLUF - Bottom Line Up Front).
2. Structure body content into FAQ format: H3 questions ending in "?" followed by 40-60 word answers.
3. Include at least one ordered list for procedural content.
4. Define key technical terms inline (e.g., "X is a type of Y that...").
5. Cite statistics with year and source where present.
6. End with a "Key Takeaways" or "Summary" section.
7. No em-dashes. No filler phrases ("In conclusion", "It is important to note").
8. Keep within the max_words limit.
9. For howto format: use numbered HowToStep structure.
10. For comparison format: include a comparison table.

Also generate a JSON-LD schema block appropriate for the content type and format.`;

export async function rewriteForAeo(
  input: RewriteForAeoInput,
  hostDelays?: HostDelayMap,
  robotsCache?: Map<string, string>,
  server?: McpServer
): Promise<RewriteAeoResult> {
  // Fetch URL if provided
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

  // Compute before score
  const beforeResult = await scoreCitationWorthiness(
    { text: originalText, target_query: input.target_query, respect_robots: false },
    hostDelays,
    robotsCache
  );
  const before_score = beforeResult.overall_score;

  const userMessage = `Target query: "${input.target_query}"
Format: ${input.format}
Max words: ${input.max_words}

Original content:
---
${originalText.substring(0, 4000)}
---

Rewrite this content for AEO. Return your response as JSON with these fields:
- rewritten_text: the rewritten content (Markdown)
- schema_additions: JSON-LD string to add to the page <head>
- changes_made: array of strings describing each change applied`;

  // Attempt MCP sampling
  if (server) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - sampling API availability varies by client; not typed in all SDK versions
      const samplingResult = await server.server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [{ role: "user", content: { type: "text", text: userMessage } }],
            systemPrompt: AEO_SYSTEM_PROMPT,
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
          // Extract JSON from response (may be wrapped in markdown code blocks)
          const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) ?? text.match(/\{[\s\S]+\}/);
          const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text;
          const parsed = JSON.parse(jsonStr) as {
            rewritten_text: string;
            schema_additions: string;
            changes_made: string[];
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
            mode: "sampling",
          };
        } catch {
          // JSON parse failed - fall through to prompt template
        }
      }
    } catch {
      // Sampling unavailable or failed - fall through to prompt template
    }
  }

  // Prompt template fallback
  const promptTemplate = `${AEO_SYSTEM_PROMPT}

${userMessage}`;

  return {
    rewritten_text: promptTemplate,
    schema_additions: "",
    changes_made: [
      "sampling/createMessage unavailable - returned prompt template for manual use",
    ],
    before_score,
    after_score: before_score, // unchanged since we did not rewrite
    mode: "prompt_template",
  };
}
