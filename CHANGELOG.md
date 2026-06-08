# Changelog

All notable changes to `@automatelab/ai-seo-mcp` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-08

### Changed

**Breaking:** MCP wire names no longer use dots. Anthropic's Messages API (and MCP clients that forward tool definitions to it — Claude Desktop, Claude Code, Zed, etc.) reject tool names outside `^[a-zA-Z0-9_-]{1,64}$`. All 19 tools renamed: namespace separator is now `_` instead of `.` (e.g. `audit.page` → `audit_page`). Semantics unchanged.

## [0.6.1] - 2026-06-02

### Fixed

- **`llms_txt_generate` output-schema validation.** The handler omitted the required `domain` field, so the SDK rejected every response with `MCP error -32602` (invalid `structuredContent`). `domain` is now populated, and `llms_full_txt` is relaxed to nullable to match the handler's `null`-when-`include_full=false` return.
- **`llms_txt_generate` now follows sitemap-index files.** It previously parsed only a top-level `<urlset>`, so sites whose `sitemap.xml` is an index pointing at child sitemaps fell back to the homepage only. It now walks the referenced child sitemaps (bounded breadth-first) and indexes the full `max_pages`.

## [0.6.0] - 2026-06-01

### Added

- **`score_agentic_browsing`** — new tool scoring a page against Lighthouse's Agentic Browsing signals: `llms_txt`, `webmcp`, `accessibility_tree`, and `layout_stability` (0-100 each), with a letter grade and findings.
- **Chunk-level extractability in `score_citation_worthiness`** — section-by-section scoring of how cleanly an LLM can lift a self-contained answer from each chunk, surfaced as a length-weighted `extractability_score` plus per-chunk analysis and the most/least extractable sections.

## [0.5.1] - 2026-06-01

### Changed

- **The GitHub Action builds the auditor from a pinned ref** rather than latest, eliminating version drift, and the CLI exit code now propagates (a `tee` in the pipeline was masking the auditor's exit status).

### Added

- **`openclaw.plugin.json`** + a clawhub `SKILL.md` so the MCP lists on clawhub / OpenClaw.
- Expanded the `audit_site` description (Glama listing) with behavioral transparency and when-to-use guidance.

## [0.5.0] - 2026-05-26

### Added

- **Body-quality dimensions in `audit_page`** — image alt-text coverage, anchor-text quality, heading hierarchy, Title↔H1 overlap, and readability.
- **Response-header dimensions in `audit_page`** — mixed-content detection plus HSTS, `X-Content-Type-Options`, and `Referrer-Policy` checks.
- **`.mcp.json`** at repo root for Open Plugins / cursor.directory compatibility.

## [0.4.1] - 2026-05-23

### Added

- **`icon.svg`** at repo root — text wordmark picked up automatically by Smithery and other catalog scanners.
- **`smithery.yaml`** with `commandFunction` and `configSchema` so Smithery's probe can start the server (without this the listing shows "No capabilities found").

### Changed

- README "All 16 tools" section renamed to **"MCP tool surface (18 tools)"** — exact tool inventory + naming tree, scannable without launching the server.

## [0.4.0] - 2026-05-20

### Changed

- **Breaking: tool rename to dot-notation.** All tools migrated from flat snake_case (`audit_page`, `check_robots`, …) to a navigable dot-notation tree (`audit_page`, `check_robots`, …). Categories: `audit.*`, `check.*`, `score.*`, `llms_txt.*`, `rewrite.*`, `extract.*`, `diff.*`, `report.*`. Update any saved invocations.

### Added

- **`outputSchema` (Zod) on every tool** — callers can type-check responses; hosts can reason about return shape before calling. Returns now also surface `structuredContent` alongside the legacy `content` text block.
- **MCP `annotations` on every tool** — `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. Hosts use these to decide whether to auto-approve a call, prompt the user, or block.
- **`.describe()` on every input parameter** that lacked one (`audit_site`, `report_save`) — input schemas are now fully self-documenting.

### Migration

- `server.tool()` → `server.registerTool()` throughout.
- Rename map (use sed/IDE find-replace on any saved configs):
  `audit_page → audit_page`, `audit_schema → audit_schema`, `audit_canonical → audit_canonical`,
  `audit_site → audit_site`, `audit_sitemap → audit_sitemap`,
  `check_robots → check_robots`, `check_sitemap → check_sitemap`, `check_technical → check_technical`,
  `score_ai_overview_eligibility → score_ai_overview_eligibility`, `score_citation_worthiness → score_citation_worthiness`, `test_citation → score_test_citation`,
  `generate_llms_txt → llms_txt_generate`, `validate_llms_txt → llms_txt_validate`,
  `rewrite_for_aeo → rewrite_aeo`, `rewrite_for_geo → rewrite_geo`,
  `extract_entities → extract_entities`, `diff_pages → diff_pages`, `save_audit_report → report_save`.

## [0.3.4] - 2026-05-18

### Added

- **`test_citation` tool** — simulates "would an AI engine cite this page for this query?". The host LLM role-plays the chosen engine (chatgpt / claude / perplexity / google_ai_overviews / any), reads the page content, and returns a cite/no-cite verdict with the verbatim excerpt it would surface plus ranked improvements. Falls back to a deterministic heuristic from `score_citation_worthiness` when MCP sampling is unavailable.
- **`audit_sitemap` tool** — site-wide content audit. Discovers the sitemap, samples N URLs by deterministic uniform stride (default 10, max 50), runs `audit_page` on each in batched parallel calls, and returns score distribution (avg / median / min / max / p25 / p75), grade distribution, worst 5 pages, and the 10 most-common findings across the sample.
- **MCP sampling in `extract_entities`** — primary path now asks the host LLM to do the NER, returning typed entities (Organization / Person / Product / Technology / Location / Event) with `sameAs` URIs. Falls back to the existing regex extractor when sampling is unavailable. The result includes `mode: "sampling" | "regex_fallback"` so callers can tell which path ran.
- **Headless rendering for SPAs** — `audit_page`, `extract_entities`, `audit_schema`, and `check_technical` accept `render: "static" | "headless"`. Default `static`. `headless` spins up Playwright Chromium (optional peer dep `playwright-core`), waits for networkidle, and audits the rendered DOM. Adds 3-10s and requires a one-time `npx playwright install chromium`.

### Changed

- `extract_entities` now returns a `mode` field indicating which extraction path ran.
- `audit_page` SPA-empty finding now differentiates between static and headless modes — the fix message guides users to install playwright-core if running static, or to inspect their JS hydration if already running headless.

## [0.3.0] - 2026-05-18

### Added

- **`audit_site` tool** — single-call aggregator that runs `audit_page` (homepage), `check_robots`, `check_sitemap`, and `audit_schema` in parallel, returning an `overall_grade` and `top_5_fixes`. Pairs with the new `audit_my_homepage` prompt.
- **`save_audit_report` tool** — renders an `audit_page` or `audit_site` result as a Markdown report and writes it to a workspace file (restricted to `MCP_WORKSPACE_ROOT`, defaults to cwd).
- **MCP prompts (5)** — `audit_my_homepage`, `find_citation_blockers`, `generate_llms_txt_for_domain`, `check_ai_crawler_access`, `score_my_citation_worthiness`. Hosts that surface prompts (Claude Desktop) get one-click entry points.
- **MCP resources (2)** — `ai-citation://signals` (the 13 citation signals with examples) and `ai-citation://crawlers` (catalog of AI crawler user-agents with robots.txt syntax).
- **In-memory LRU fetch cache** — back-to-back tools targeting the same URL now share a single fetch. 5-minute TTL, 50-entry default. Bypass via `DISABLE_CACHE=true`; tune with `FETCH_CACHE_MAX_ENTRIES` and `FETCH_CACHE_TTL_MS`.
- **SPA detection** — `audit_page` now emits a `content_quality` field (`static_html` | `ssr_likely` | `spa_empty`). When `spa_empty` (body text < 500 chars AND > 5 script tags), it surfaces a critical finding so users know the audit is degraded.
- **GitHub Action** — `action.yml` and an `ai-seo-audit` CLI for CI use. Audits a list of URLs on PR, fails the build on score regression, posts a workflow summary, and can write a Markdown report artifact.

### Notes

- Skips 0.2.0; this release bundles the full v0.2 + v0.3 backlog on top of the 0.1.x patch line (0.1.1 mcpName, 0.1.2 diff_pages + scorecard HTML, 0.1.3 repo rename).
- `audit_page` response shape is back-compatible — `content_quality` is additive.

## [0.1.3] - 2026-05-17

### Changed

- GitHub repository renamed to `ai-seo-mcp`. Package name (`@automatelab/ai-seo-mcp`) and all install commands unchanged.
- Updated `mcpName` to `io.github.AutomateLab-tech/ai-seo-mcp` in `package.json` and `server.json`.
- Updated homepage, repository URLs, User-Agent string, and scorecard footer link to the new repo URL.

## [0.1.2] - 2026-05-16

- `diff_pages` tool added; optional HTML scorecard for `audit_page`.

## [0.1.1] - 2026-05-15

### Added

- `mcpName` field in `package.json` for MCP Registry ownership verification.

## [0.1.0] - 2026-05-15

Initial public release.

### Added

- 13 tools covering AI-SEO auditing, rewriting, and crawler discovery:
  - `audit_page`, `audit_schema`, `audit_canonical`
  - `check_robots`, `check_sitemap`, `check_technical`
  - `score_ai_overview_eligibility`, `score_citation_worthiness`
  - `generate_llms_txt`, `validate_llms_txt`
  - `rewrite_for_aeo`, `rewrite_for_geo`
  - `extract_entities`
- Polite-fetch contract: `robots.txt` respected by default, honest `User-Agent`, host-level rate limiting, response-size cap.
- Configurable via five environment variables: `USER_AGENT`, `FETCH_TIMEOUT_MS`, `MAX_BYTES`, `RESPECT_ROBOTS`, `INTER_REQUEST_DELAY_MS`.
- Detection for 10+ AI crawler user-agents including `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `Bytespider`, `Meta-ExternalAgent`.
- MCP sampling support for rewrite tools, with graceful fallback to prompt-template output when the host client does not implement sampling.
- 16 vitest smoke tests against `automatelab.tech`, `example.com`, and `en.wikipedia.org`.

### Known limitations

- No JavaScript rendering. Pages that require JS to populate content will return incomplete audit results.
- Entity extraction is regex-based; false positives and misses are expected on non-English or highly technical text.
- No PyPI distribution in 0.1.0. Planned for 0.2.0.
- AI Overview eligibility scoring uses deterministic heuristics from published correlation studies, not live SERP queries.

[0.3.0]: https://github.com/AutomateLab-tech/ai-seo-mcp/releases/tag/v0.3.0
[0.1.3]: https://github.com/AutomateLab-tech/ai-seo-mcp/releases/tag/v0.1.3
[0.1.2]: https://github.com/AutomateLab-tech/ai-seo-mcp/releases/tag/v0.1.2
[0.1.1]: https://github.com/AutomateLab-tech/ai-seo-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/AutomateLab-tech/ai-seo-mcp/releases/tag/v0.1.0
