# DX.10a restored claims (website#28)

The copy DX.10a brings back, captured from the static build of the branch after `main` was merged in. Each region was captured at 1280x800 (desktop) and 390x844 (phone) in Chromium and WebKit, at device scale factor 1. Files are named `<browser>-<size>-<region>.png`.

| Region | Page | What changed |
| --- | --- | --- |
| `home-determinism` | `/` | New workflow item “Same result in every engine”, which links `/proof`. It is shown only while every golden in the synced evidence agrees. |
| `proof-source` | `/proof` | “Where these numbers come from” now says the CI *is configured to* write the file in its parity job on each push to `main`. It links `ci.yml` at the evidence revision and names the run's workflow and job. |
| `ai-csp` | `/ai#csp` | New “The content security policy” section: instructions are context, not enforcement; `compileHeaders` in `@ruken/manifest`; the CLI's CSP probe in Chromium, with a link to its source. |
| `examples-how` | `/examples` | New “How an example runs” section: live update after a pause, the last good preview kept, line and column diagnostics, Restart. It is scoped to the playground. |
| `docs-boot-errors` | `/docs/boot-errors` | New doc page generated from the framework API index: the `BootError` union, each member with its doc comment, and what the list does not cover. |
| `docs-mobile-ui-journeys` | `/docs/mobile-ui` | New “Tested input journeys” paragraph: which journeys run at 780x270 and at other sizes, kept apart from real-device acceptance. |
| `cheatsheet-links` | `/cheatsheet` | The plain-text link is now “Complete generated reference (plain text)”, pointing at `/llms-api.txt`. |

## What to check

- The wording matches the Restored section of `docs/2026-10-14-cut-claims.md` (the Owner's acceptance of the restored copy is the DX.10a gate).
- No page scrolls sideways. The capture measured `scrollWidth - clientWidth` = 0 px on every page, in both browsers and at both sizes.
- The headings read in sentence case. The first capture showed “How An Example Runs”, because `/examples` capitalises its module headings. The new section now opts out.
- At 390 px, the CSP paragraph wraps around two inline code names. It stays readable and does not overflow.

## How they were made

A throwaway Playwright script (not committed) ran on the static build (`vite build` plus `write-seo-files`), served by `vite preview`. It scrolled each region into view, took an element screenshot and measured the page's horizontal overflow.
