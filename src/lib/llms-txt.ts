// llms.txt generator and validator helpers.

import type { Finding } from "../types.js";

export interface LlmsPage {
  url: string;
  title: string;
  description: string;
}

/** Group pages by path prefix into sections. */
export function groupPagesBySection(pages: LlmsPage[]): Map<string, LlmsPage[]> {
  const groups = new Map<string, LlmsPage[]>();

  for (const page of pages) {
    try {
      const url = new URL(page.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const group = parts.length >= 2 ? `/${parts[0]}/` : "Root";
      const existing = groups.get(group) ?? [];
      existing.push(page);
      groups.set(group, existing);
    } catch {
      const existing = groups.get("Root") ?? [];
      existing.push(page);
      groups.set("Root", existing);
    }
  }

  return groups;
}

/** Generate llms.txt content from grouped pages. */
export function generateLlmsTxt(
  siteName: string,
  siteDescription: string,
  groups: Map<string, LlmsPage[]>
): string {
  const lines: string[] = [];
  lines.push(`# ${siteName}`);
  lines.push("");
  lines.push(`> ${siteDescription}`);
  lines.push("");

  for (const [section, pages] of groups.entries()) {
    const sectionTitle = section === "Root"
      ? "Pages"
      : section.replace(/^\/|\/$/g, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`## ${sectionTitle}`);
    lines.push("");
    for (const page of pages) {
      const desc = page.description
        ? page.description.substring(0, 120)
        : "";
      if (desc) {
        lines.push(`- [${page.title}](${page.url}): ${desc}`);
      } else {
        lines.push(`- [${page.title}](${page.url})`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** Generate llms-full.txt by concatenating page full text. */
export function generateLlmsFullTxt(
  siteName: string,
  siteDescription: string,
  pages: Array<LlmsPage & { fullText?: string }>,
  maxBytes = 500 * 1024
): { content: string; truncated: boolean } {
  const header = `# ${siteName}\n\n> ${siteDescription}\n\n`;
  const parts: string[] = [header];
  let totalLen = header.length;
  let truncated = false;

  for (const page of pages) {
    const section = `---\n# ${page.title}\nURL: ${page.url}\n\n${page.fullText ?? page.description}\n\n`;
    if (totalLen + section.length > maxBytes) {
      truncated = true;
      break;
    }
    parts.push(section);
    totalLen += section.length;
  }

  return { content: parts.join(""), truncated };
}

/** Validate a llms.txt string and return findings. */
export function validateLlmsTxtContent(content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  // H1 must be first non-empty element
  const firstMeaningfulLine = lines.find((l) => l.trim().length > 0);
  if (!firstMeaningfulLine || !firstMeaningfulLine.startsWith("# ")) {
    findings.push({
      severity: "critical",
      category: "llms_txt",
      where: "line 1",
      message: "llms.txt must start with an H1 heading (# Site Name).",
      fix: "Add '# Your Site Name' as the first line of the file.",
      estimated_impact: "high",
    });
  }

  // Blockquote must be present
  const hasBlockquote = lines.some((l) => l.trim().startsWith("> "));
  if (!hasBlockquote) {
    findings.push({
      severity: "warning",
      category: "llms_txt",
      where: "file structure",
      message: "llms.txt is missing a blockquote description after the H1.",
      fix: "Add '> One to three sentence description of the site.' after the H1.",
      estimated_impact: "medium",
    });
  }

  // H2 sections
  const hasH2 = lines.some((l) => l.startsWith("## "));
  if (!hasH2) {
    findings.push({
      severity: "info",
      category: "llms_txt",
      where: "file structure",
      message: "llms.txt has no H2 section headings.",
      fix: "Group pages under H2 headings like '## Blog Posts' or '## Tools'.",
    });
  }

  // All Markdown links must be absolute URLs
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    linkPattern.lastIndex = 0;
    while ((match = linkPattern.exec(line)) !== null) {
      const href = match[2];
      const title = match[1];
      if (!title.trim()) {
        findings.push({
          severity: "warning",
          category: "llms_txt",
          where: `line ${lineNum}`,
          message: "Markdown link has an empty title.",
          fix: "Add a descriptive title inside the square brackets.",
        });
      }
      if (!href.startsWith("http://") && !href.startsWith("https://")) {
        findings.push({
          severity: "critical",
          category: "llms_txt",
          where: `line ${lineNum}`,
          message: `Relative link "${href.substring(0, 60)}" found - all links must be absolute URLs.`,
          fix: "Replace with the full absolute URL including https://.",
          estimated_impact: "medium",
        });
      }
    }
  }

  return findings;
}

/** Extract all Markdown links from llms.txt content. Returns [{title, url}] */
export function extractLlmsLinks(content: string): Array<{ title: string; url: string }> {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const links: Array<{ title: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(content)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }
  return links;
}
