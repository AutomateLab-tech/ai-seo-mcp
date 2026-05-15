// Tool: validate_llms_txt
// Validates an existing llms.txt or llms-full.txt against the spec.

import { z } from "zod";
import { politeFetch, politeHead, type HostDelayMap } from "../lib/fetch.js";
import { validateLlmsTxtContent, extractLlmsLinks } from "../lib/llms-txt.js";
import type { Finding } from "../types.js";

export const validateLlmsTxtInputSchema = z
  .object({
    url: z.string().url().optional(),
    content: z.string().optional(),
    check_links: z.boolean().optional().default(true),
  })
  .refine((d) => d.url !== undefined || d.content !== undefined, {
    message: "One of url or content is required",
  });

export type ValidateLlmsTxtInput = z.infer<typeof validateLlmsTxtInputSchema>;

export interface ValidateLlmsTxtResult {
  valid: boolean;
  links_total: number;
  links_broken: number;
  findings: Finding[];
}

export async function validateLlmsTxt(
  input: ValidateLlmsTxtInput,
  hostDelays?: HostDelayMap,
  robotsCache?: Map<string, string>
): Promise<ValidateLlmsTxtResult> {
  let content: string;

  if (input.url) {
    // If given a domain-style URL, append /llms.txt
    let fetchUrl = input.url;
    if (!fetchUrl.endsWith(".txt") && !fetchUrl.includes("llms")) {
      fetchUrl = fetchUrl.replace(/\/$/, "") + "/llms.txt";
    }
    const result = await politeFetch(fetchUrl, {
      respectRobots: false,
      hostDelays,
      robotsCache,
    });
    content = result.body;
  } else {
    content = input.content!;
  }

  const findings: Finding[] = validateLlmsTxtContent(content);

  let links_total = 0;
  let links_broken = 0;

  if (input.check_links) {
    const links = extractLlmsLinks(content);
    links_total = links.length;
    const delays = hostDelays ?? new Map<string, number>();

    for (const link of links) {
      const status = await politeHead(link.url, { hostDelays: delays });
      if (status === null || status === 404 || status === 410) {
        links_broken++;
        findings.push({
          severity: "warning",
          category: "llms_txt",
          where: link.url,
          message: `Broken link: "${link.title}" returns ${status ?? "no response"}.`,
          fix: `Update or remove the link to ${link.url}.`,
        });
      }
    }
  }

  const valid = !findings.some((f) => f.severity === "critical");

  return {
    valid,
    links_total,
    links_broken,
    findings,
  };
}
