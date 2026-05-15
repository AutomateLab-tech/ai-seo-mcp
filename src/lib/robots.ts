// robots.txt parser wrapper and AI crawler registry.

// robots-parser is a CommonJS module; import via createRequire for reliable NodeNext compat.
import { createRequire } from "module";
import { fetch as undiciFetch } from "undici";
import { POLITE_FETCH } from "./config.js";
import crawlersData from "./crawlers.json" with { type: "json" };

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
const robotsParser = _require("robots-parser") as (url: string, text: string) => {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getSitemaps(): string[];
};

export type CrawlerStatus = "allowed" | "disallowed" | "not-mentioned";

export interface CrawlerRegistry {
  training: string[];
  search: string[];
  user_triggered: string[];
  robots_token_only: string[];
}

export const CRAWLERS: CrawlerRegistry = crawlersData as CrawlerRegistry;

/** All crawler user-agents we check (excludes robots_token_only which have no HTTP UA). */
export function getAllCrawlerAgents(): string[] {
  return [
    ...CRAWLERS.training,
    ...CRAWLERS.search,
    ...CRAWLERS.user_triggered,
  ];
}

/**
 * Fetch raw robots.txt content. Does NOT use politeFetch to avoid recursion.
 * Returns empty string if fetch fails.
 */
export async function fetchRobotsTxt(robotsUrl: string): Promise<string> {
  try {
    const response = await undiciFetch(robotsUrl, {
      method: "GET",
      headers: { "User-Agent": POLITE_FETCH.USER_AGENT },
      signal: AbortSignal.timeout(POLITE_FETCH.TIMEOUT_MS),
      redirect: "follow",
    });
    const text = await response.text();
    console.error(`[robots] ${response.status} ${robotsUrl}`);
    if (response.status === 404) return "";
    return text;
  } catch {
    return "";
  }
}

/**
 * Parse robots.txt text and check if a URL is allowed for a given user-agent.
 * Returns true (allowed) if robots.txt is empty or parse fails.
 */
export function checkRobotsAllowed(
  robotsText: string,
  url: string,
  userAgent: string
): boolean {
  if (!robotsText) return true;
  try {
    const robots = robotsParser(url, robotsText);
    const result = robots.isAllowed(url, userAgent);
    return result !== false;
  } catch {
    return true;
  }
}

/**
 * Check the robots.txt posture for a specific crawler user-agent.
 * Returns "allowed", "disallowed", or "not-mentioned".
 */
export function checkCrawlerStatus(
  robotsText: string,
  robotsUrl: string,
  userAgent: string
): CrawlerStatus {
  if (!robotsText) return "not-mentioned";
  try {
    const robots = robotsParser(robotsUrl, robotsText);
    // Check if explicitly disallowed
    const isAllowed = robots.isAllowed("/", userAgent);
    if (isAllowed === false) return "disallowed";

    // Check if explicitly mentioned (as opposed to just allowed by default)
    // robots-parser returns undefined when not mentioned, false when disallowed, true when allowed
    // We detect "not-mentioned" by checking if the agent appears anywhere in the robots.txt
    const lowerText = robotsText.toLowerCase();
    const agentLower = userAgent.toLowerCase();
    if (!lowerText.includes(agentLower)) return "not-mentioned";
    return "allowed";
  } catch {
    return "not-mentioned";
  }
}
