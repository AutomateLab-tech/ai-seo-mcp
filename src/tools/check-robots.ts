// Tool: check_robots
// Parses a domain's robots.txt and reports per-crawler allow/disallow posture.

import { z } from "zod";
import { fetchRobotsTxt, checkCrawlerStatus, CRAWLERS, type CrawlerStatus } from "../lib/robots.js";
import type { Finding } from "../types.js";

export const checkRobotsInputSchema = z.object({
  domain: z
    .string()
    .min(3)
    .describe("Hostname or origin to inspect. Examples: `example.com`, `https://example.com`, `https://example.com/`. The tool fetches `https://<domain>/robots.txt` and reports per-crawler allow/disallow posture for all known AI training crawlers (GPTBot, CCBot, etc.), AI search crawlers (ChatGPT-User, PerplexityBot), and user-triggered fetchers. Read-only HTTP GET to /robots.txt only."),
});

export type CheckRobotsInput = z.infer<typeof checkRobotsInputSchema>;

export interface RobotsResult {
  robots_url: string;
  fetched_at: string;
  training_crawlers: Record<string, CrawlerStatus>;
  search_crawlers: Record<string, CrawlerStatus>;
  user_triggered: Record<string, CrawlerStatus>;
  findings: Finding[];
  recommended_posture: "block_training_allow_search" | "allow_all" | "block_all" | "custom";
}

function normalizeDomain(domain: string): string {
  let d = domain.trim();
  if (d.startsWith("http://") || d.startsWith("https://")) {
    try {
      const url = new URL(d);
      return url.hostname;
    } catch {
      return d;
    }
  }
  return d.replace(/\/$/, "");
}

export async function checkRobots(input: CheckRobotsInput): Promise<RobotsResult> {
  const hostname = normalizeDomain(input.domain);
  const robotsUrl = `https://${hostname}/robots.txt`;
  const fetched_at = new Date().toISOString();
  const findings: Finding[] = [];

  const robotsText = await fetchRobotsTxt(robotsUrl);

  if (!robotsText) {
    findings.push({
      severity: "warning",
      category: "robots",
      where: robotsUrl,
      message: "robots.txt not found (404 or empty response).",
      fix: "Create a robots.txt file at the domain root. All AI crawlers default to allow-all when it is absent.",
      estimated_impact: "medium",
    });
  }

  // Evaluate each crawler category
  const training_crawlers: Record<string, CrawlerStatus> = {};
  for (const agent of CRAWLERS.training) {
    training_crawlers[agent] = checkCrawlerStatus(robotsText, robotsUrl, agent);
  }

  const search_crawlers: Record<string, CrawlerStatus> = {};
  for (const agent of CRAWLERS.search) {
    search_crawlers[agent] = checkCrawlerStatus(robotsText, robotsUrl, agent);
  }

  const user_triggered: Record<string, CrawlerStatus> = {};
  for (const agent of CRAWLERS.user_triggered) {
    user_triggered[agent] = checkCrawlerStatus(robotsText, robotsUrl, agent);
  }

  // Emit findings for key conditions
  for (const agent of CRAWLERS.training) {
    if (training_crawlers[agent] !== "disallowed") {
      findings.push({
        severity: "info",
        category: "robots",
        where: `robots.txt User-agent: ${agent}`,
        message: `${agent} is not disallowed. Your content may be harvested for model training.`,
        fix: `Choose your training policy separately from search. To opt out for this agent, add:\nUser-agent: ${agent}\nDisallow: /`,
      });
    }
  }

  // OAI-SearchBot should be explicitly allowed
  if (search_crawlers["OAI-SearchBot"] === "not-mentioned") {
    findings.push({
      severity: "info",
      category: "robots",
      where: "robots.txt User-agent: OAI-SearchBot",
      message: "OAI-SearchBot has no named group. Normal robots.txt matching rules apply; a named Allow rule does not itself improve citation probability.",
      fix: "Check the wildcard group and path rules if search crawling is intended.",
    });
  }

  // Only search restrictions affect citation-readiness warnings.
  for (const agent of CRAWLERS.search) {
    if (search_crawlers[agent] !== "disallowed") continue;
    findings.push({
      severity: "warning",
      category: "robots",
      where: `robots.txt User-agent: ${agent}`,
      message: `${agent} is blocked from automated search crawling. Crawl permission does not guarantee citations.`,
      fix: `If search crawling is intended, review the ${agent} Disallow directive and the relevant path rules.`,
      estimated_impact: "high",
    });
  }

  // Robots-token-only notes
  for (const token of CRAWLERS.robots_token_only) {
    const lowerText = (robotsText ?? "").toLowerCase();
    if (lowerText.includes(token.toLowerCase())) {
      findings.push({
        severity: "info",
        category: "robots",
        where: `robots.txt User-agent: ${token}`,
        message: `${token} is a training-opt-out token, not an HTTP crawler. It does not affect search crawling.`,
        fix: "No action needed - this token correctly controls training data opt-out.",
      });
    }
  }

  // Google-Agent always present as info
  findings.push({
    severity: "info",
    category: "robots",
    where: "robots.txt User-agent: Google-Agent",
    message: "Google-Agent (Mariner) ignores robots.txt per Google's documentation. You cannot opt out via robots.txt.",
    fix: "No robots.txt action possible for Google-Agent. Use noindex meta tags if you need page-level exclusion.",
  });

  // Determine recommended posture
  const allTrainingBlocked = CRAWLERS.training.every(
    (a) => training_crawlers[a] === "disallowed"
  );
  const allSearchAllowedOrUnmentioned = CRAWLERS.search.every(
    (a) => search_crawlers[a] !== "disallowed"
  );
  const allTrainingAllowed = CRAWLERS.training.every(
    (a) => training_crawlers[a] !== "disallowed"
  );
  const allSearchBlocked = CRAWLERS.search.every(
    (a) => search_crawlers[a] === "disallowed"
  );

  let recommended_posture: RobotsResult["recommended_posture"] = "custom";
  if (allTrainingBlocked && allSearchAllowedOrUnmentioned) {
    recommended_posture = "block_training_allow_search";
  } else if (allTrainingAllowed && !allSearchBlocked) {
    recommended_posture = "allow_all";
  } else if (allTrainingBlocked && allSearchBlocked) {
    recommended_posture = "block_all";
  }

  return {
    robots_url: robotsUrl,
    fetched_at,
    training_crawlers,
    search_crawlers,
    user_triggered,
    findings,
    recommended_posture,
  };
}
