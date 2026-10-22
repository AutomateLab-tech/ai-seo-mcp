# Review an AI-SEO audit in CI

Start with one URL and keep the input and returned findings with the build. Run `audit_page` for a real public page, or `audit_schema` with inline JSON-LD for a check that needs no network fetch.

For a schema fixture, use `{"@context":"https://schema.org","@type":"Article","headline":"Fixture article"}` as the `schema_json` string. Compare that with malformed JSON and a real FAQPage fixture. Inspect findings rather than treating every score difference as a regression.

The repository Action and `ai-seo-audit` CLI provide the CI entry point. Read `action.yml` for current input names, pin a released ref, and record the threshold you chose. Fail the build for the actual contract you want to protect, such as a missing canonical or malformed schema. Keep threshold changes in a reviewed commit.

Use a local fixture for deterministic checks and a small live smoke check for fetching. A live site's content and network response can change independently of this package. Keep those outcomes separate. A passing audit measures this tool's checks; it is not a promise of search or AI citation results.
