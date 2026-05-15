// Tool: extract_entities
// Extracts named entities, linked concepts, and sameAs graph nodes from page content.

import { z } from "zod";
import { politeFetch, type HostDelayMap } from "../lib/fetch.js";
import { parseBody } from "../lib/html.js";
import { parseJsonLd } from "../lib/schema.js";
import {
  extractJsonLdEntities,
  extractTextEntities,
  mergeEntities,
  type ExtractedEntity,
} from "../lib/entities.js";
import type { Finding } from "../types.js";

export const extractEntitiesInputSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().optional(),
    respect_robots: z.boolean().optional().default(true),
  })
  .refine((d) => d.url !== undefined || d.text !== undefined, {
    message: "One of url or text is required",
  });

export type ExtractEntitiesInput = z.infer<typeof extractEntitiesInputSchema>;

export interface ExtractEntitiesResult {
  entities: ExtractedEntity[];
  entity_count: number;
  connected_entity_count: number;
  citation_density_score: number;
  findings: Finding[];
}

export async function extractEntities(
  input: ExtractEntitiesInput,
  hostDelays?: HostDelayMap,
  robotsCache?: Map<string, string>
): Promise<ExtractEntitiesResult> {
  const findings: Finding[] = [];
  let bodyText = "";
  let jsonLdBlocks: ReturnType<typeof parseJsonLd> = [];

  if (input.url) {
    const result = await politeFetch(input.url, {
      respectRobots: input.respect_robots,
      hostDelays,
      robotsCache,
    });
    const pageData = parseBody(result.body, input.url);
    bodyText = pageData.bodyText;
    jsonLdBlocks = parseJsonLd(result.body);
  } else {
    bodyText = input.text!;
  }

  const jsonLdEntities = extractJsonLdEntities(jsonLdBlocks);
  const textEntities = extractTextEntities(bodyText);
  const entities = mergeEntities(jsonLdEntities, textEntities, bodyText);

  const entity_count = entities.length;
  const connected_entity_count = entities.filter((e) => e.same_as.length > 0).length;
  // Threshold: 15 connected entities = score of 100
  const citation_density_score = Math.min(100, Math.round((connected_entity_count / 15) * 100));

  if (entity_count === 0) {
    findings.push({
      severity: "warning",
      category: "authority",
      where: "page-level",
      message: "No named entities detected on this page.",
      fix: "Add JSON-LD schema with named entities (Organization, Person, Product) and sameAs links.",
      estimated_impact: "medium",
    });
  } else if (connected_entity_count < 5) {
    findings.push({
      severity: "warning",
      category: "authority",
      where: "page-level",
      message: `Only ${connected_entity_count} entities have sameAs links. Pages with 15+ connected entities have 4.8x higher AI citation probability.`,
      fix: "Add sameAs links to JSON-LD entity nodes pointing to Wikidata, Wikipedia, LinkedIn, or official brand sites.",
      estimated_impact: "high",
    });
  }

  return {
    entities,
    entity_count,
    connected_entity_count,
    citation_density_score,
    findings,
  };
}
