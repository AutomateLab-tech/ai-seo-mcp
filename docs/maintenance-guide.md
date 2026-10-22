# AI-SEO MCP maintenance guide

Audit one page before a whole site. Treat the score as a diagnostic: check the reported evidence and fix the actual content or markup. A high score does not guarantee a citation.

## Installation and compatibility

Follow the repository README for the supported install method and runtime. Pin the version used in a reproducible example. Keep credentials in your client configuration, outside shared fixtures.

## Verified tool surface

The local compiled server returned these names through MCP `tools/list` on 12 October 2026. Recheck after upgrading.

- `audit_page`
- `audit_schema`
- `audit_canonical`
- `check_robots`
- `check_sitemap`
- `check_technical`
- `score_ai_overview_eligibility`
- `score_agentic_browsing`
- `llms_txt_generate`
- `pricing_generate`
- `llms_txt_validate`
- `score_citation_worthiness`
- `rewrite_aeo`
- `rewrite_geo`
- `extract_entities`
- `score_test_citation`
- `diff_pages`
- `audit_site`
- `audit_sitemap`
- `report_save`

## First call

Start with `audit_page`. Required fields: `url`. Read its input schema before passing a recorded fixture.

## Verify a change

Record the package or snapshot version, exact input, observation time and actual output. Check a materially different input and a valid neighboring case. Treat expected output as a fixture, not a live measurement.

## Usage walkthrough

See [the tested usage walkthrough](usage-walkthrough.md) for a concrete input and verification steps.
