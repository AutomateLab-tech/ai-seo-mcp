## Summary

<!-- One or two sentences. What does this PR change and why? -->

## Type of change

- [ ] New tool
- [ ] Bug fix in existing tool
- [ ] Scoring rubric refinement
- [ ] New AI crawler added to `crawlers.json`
- [ ] Docs / README / CHANGELOG only
- [ ] Build / tooling

## Checklist

- [ ] `npm run build` passes.
- [ ] `npm test` passes locally.
- [ ] New or changed tools have at least one smoke test in `tests/smoke.test.ts`.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] `README.md` updated if a tool or public-facing behavior changed.
- [ ] No emojis or em-dashes added in source files.
- [ ] Network calls go through `src/lib/fetch.ts` (no direct `fetch` / `undici` from a tool).

## Linked issue

<!-- e.g. Closes #42 -->
