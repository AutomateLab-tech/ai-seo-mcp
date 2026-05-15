# @automatelab/ai-seo-mcp

[![npm version](https://img.shields.io/npm/v/@automatelab/ai-seo-mcp.svg)](https://www.npmjs.com/package/@automatelab/ai-seo-mcp)
[![license](https://img.shields.io/npm/l/@automatelab/ai-seo-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@automatelab/ai-seo-mcp.svg)](https://nodejs.org)

Vendor-agnostic MCP server that audits, scores, and rewrites web pages for AI-citation eligibility. No API keys. No registration.

Works in Claude Desktop, Cursor, Cline, Windsurf, VS Code (Copilot / Continue), and any client that speaks the [Model Context Protocol](https://modelcontextprotocol.io).

## Why it's important

AI assistants are eating search. ChatGPT, Perplexity, Google AI Overviews, and Claude with web access answer a fast-growing share of "what is X" and "how do I Y" queries - and each answer cites a handful of pages. Being one of those cited sources is binary: you are in the answer, or you are invisible.

The signals that decide citation eligibility are not what classic SEO tools measure. Lighthouse will not flag missing `FAQPage` schema. Search Console will not tell you that `GPTBot` is allowed but `OAI-SearchBot` is blocked. Ahrefs does not score citation worthiness. Screaming Frog does not validate `llms.txt`.

A page that no AI assistant cites is a page that, for a growing share of users, does not exist.

This MCP gives you a short list of no-brainer fixes that dramatically increase the odds of getting cited by an AI assistant versus unprepared text. It audits the specific signals AI assistants use - schema completeness, FAQ structure, AI-crawler allowlists, `llms.txt`, entity density, freshness, authority - and for each gap it returns the exact change to make. No opaque scores, no guesswork. Most of the fixes are one-time edits to a template or a `robots.txt` and pay off on every page you publish from then on.

## What it does

Modern search increasingly happens inside AI assistants. ChatGPT Search, Perplexity, Google AI Overviews, Claude with web access, and Microsoft Copilot all cite pages they consider authoritative, well-structured, and machine-readable. The signals that drive those citations overlap with classic SEO but are not the same.

This MCP gives any AI client a toolkit to inspect a URL and answer questions like:

- Is this page set up to be cited by AI Overviews and Perplexity?
- What schema is missing, malformed, or deprecated?
- Are GPTBot, ClaudeBot, OAI-SearchBot, and PerplexityBot allowed by `robots.txt`?
- Does the page have a chance at the Answer Engine slot for a given query?
- Rewrite this passage into a citation-ready answer block.

13 tools. Deterministic where possible. Rule-based scoring with explicit rubrics, not black-box numbers.

## Install

```bash
npx -y @automatelab/ai-seo-mcp
```

Requires Node 20 or later. No global install needed.

### Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` on Windows, or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "ai-seo": {
      "command": "npx",
      "args": ["-y", "@automatelab/ai-seo-mcp"]
    }
  }
}
```

Restart Claude Desktop. The 13 tools appear in the tool tray.

### Cursor

Add to `.cursor/mcp.json` in the project root or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "ai-seo": {
      "command": "npx",
      "args": ["-y", "@automatelab/ai-seo-mcp"]
    }
  }
}
```

### Cline

Add to VS Code settings or `.cline/mcp_settings.json`:

```json
{
  "mcpServers": {
    "ai-seo": {
      "command": "npx",
      "args": ["-y", "@automatelab/ai-seo-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Windsurf, Continue, VS Code Copilot

Use the same `command` / `args` pattern. Any MCP client that supports stdio transport works.

## Quickstart

After adding the config snippet above and restarting your client, try these prompts:

- *"Run an AI-SEO audit on `https://example.com` and tell me the top three things to fix."* - calls `audit_page` and returns a scored report with prioritized findings.
- *"Check which AI crawlers my site allows in `robots.txt` for `https://yourdomain.com`."* - calls `check_robots` and lists per-crawler allow/disallow.
- *"Score how citation-worthy this blog post is for Perplexity and ChatGPT: `https://...`."* - calls `score_citation_worthiness`.
- *"Generate an `llms.txt` for `https://yourdomain.com` from its sitemap."* - calls `generate_llms_txt`.
- *"Rewrite this passage for Answer Engine Optimization: [paste passage]."* - calls `rewrite_for_aeo` (uses MCP sampling if your client supports it).

No API keys. No accounts. The first call may take a few seconds while `npx` downloads the package; subsequent calls are instant.

## Tools

| Tool | Purpose |
|------|---------|
| `audit_page` | Composite AI-SEO audit with 8-dimension scoring (schema, technical, structure, robots, freshness, authority, entity density, sitemap). |
| `audit_schema` | Validate JSON-LD against Schema.org rules and AI-citation best practice. Flags deprecated patterns. |
| `audit_canonical` | Canonical link integrity, trailing-slash hygiene, `og:url` consistency. |
| `check_robots` | Parse `robots.txt` and report per-crawler allow/disallow for all known AI crawlers. Surfaces the GPTBot-blocked-but-OAI-SearchBot-allowed trap. |
| `check_sitemap` | Validate XML sitemaps: presence, URL count, `lastmod` freshness, image/video extensions. |
| `check_technical` | HEAD tag audit: canonical, OpenGraph, Twitter Card, hreflang, HTTPS, noindex, title hygiene. |
| `score_ai_overview_eligibility` | Score a page's probability of appearing in Google AI Overviews using current correlation factors. |
| `generate_llms_txt` | Generate `llms.txt` and optionally `llms-full.txt` from a domain's sitemap. |
| `validate_llms_txt` | Lint an existing `llms.txt` for spec compliance and broken links. |
| `score_citation_worthiness` | Score how citable a page or text block is for Perplexity, ChatGPT, Google AI Overviews, and Claude. |
| `rewrite_for_aeo` | Rewrite content for Answer Engine Optimization (BLUF structure, FAQ format, schema additions). |
| `rewrite_for_geo` | Rewrite content for Generative Engine Optimization (entity definitions, comparison tables, synthesis-ready structure). |
| `extract_entities` | Extract named entities, `sameAs` links, and citation-density score from a page's content and structured data. |

## Example

In Claude Desktop, after wiring the server above:

> **You:** Run an AI-SEO audit on `https://automatelab.tech/how-to-connect-zapier-to-notion`.

Claude calls `audit_page`. Result (truncated):

```json
{
  "url": "https://automatelab.tech/how-to-connect-zapier-to-notion",
  "fetched_at": "2026-05-15T10:32:00Z",
  "score": 61,
  "grade": "C",
  "dimension_scores": {
    "schema": 45, "technical": 80, "structure": 40,
    "robots": 90, "freshness": 85, "authority": 40,
    "entity_density": 21, "sitemap": 100
  },
  "findings": [
    {
      "severity": "critical",
      "category": "structure",
      "where": "<body>",
      "message": "No FAQ structure found (no FAQPage schema or H3 question headings).",
      "fix": "Add FAQ H3 headings ending in '?' with answer paragraphs, and a FAQPage JSON-LD block.",
      "estimated_impact": "high"
    },
    {
      "severity": "warning",
      "category": "authority",
      "where": "page-level",
      "message": "Low authority signals - missing Organization or author Person schema.",
      "fix": "Add Organization JSON-LD and Article.author as a Person node with sameAs links.",
      "estimated_impact": "high"
    }
  ]
}
```

Claude then summarizes the findings and proposes fixes. For rewrite tools, the host model (Claude / GPT / etc.) does the rewriting via MCP sampling.

## Environment variables

All variables are optional. Set them in the MCP client config under `"env"`.

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_AGENT` | `automatelab-ai-seo-mcp/0.1.0 (+https://github.com/AutomateLab-tech/ai-seo)` | HTTP User-Agent on all fetches. |
| `FETCH_TIMEOUT_MS` | `15000` | Per-request timeout in milliseconds. |
| `MAX_BYTES` | `5242880` | Maximum response body size in bytes (5 MB). |
| `RESPECT_ROBOTS` | `true` | Global default for robots.txt compliance. Set `"false"` to disable. |
| `INTER_REQUEST_DELAY_MS` | `1500` | Minimum delay between requests to the same host within a tool call. |

## Polite by default

Every tool that hits the network goes through one fetch path that:

- Respects `robots.txt` for the configured User-Agent (override with `RESPECT_ROBOTS=false`).
- Identifies itself honestly via `User-Agent` (no spoofing as a browser).
- Sleeps `INTER_REQUEST_DELAY_MS` between requests to the same host within a tool call.
- Times out at `FETCH_TIMEOUT_MS` per request.
- Caps response body at `MAX_BYTES` and refuses non-HTML / non-XML payloads where inappropriate.

This MCP is not a scraper. It audits public pages the way Lighthouse or Screaming Frog do, one URL at a time.

## What it does not do

- No JavaScript-rendered scraping. Only static HTML is fetched. SPAs that render content client-side will produce incomplete audits.
- No paid-API integrations (Search Console, Ahrefs, Semrush). Bring those signals manually if you need them.
- No site-wide crawling. Tools that need multiple URLs read from the public sitemap.
- No live SERP checks. AI Overview eligibility is a deterministic heuristic, not a guarantee.
- English-language tuning. Technical checks (schema, robots, canonical) are language-agnostic; content scoring assumes English.
- Entity extraction is regex-based (title-case phrases, acronyms, CamelCase). False positives and misses are expected on v0.1.

## Contributing

Bug reports, feature ideas, and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## License

MIT - see [LICENSE](./LICENSE).

## Acknowledgements

Built by [automatelab.tech](https://automatelab.tech/products/mcp/ai-seo/)

Schema.org, `robots.txt`, and `llms.txt` are open standards. Crawler user-agent data is sourced from Anthropic, OpenAI, Google, Perplexity, and Cloudflare documentation. The MCP itself is built on the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic.
