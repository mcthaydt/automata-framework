# STANDALONE.1 target-neutral copy (website)

The pages STANDALONE.1 changes, captured from the static build (served by `vite preview`) at 1280x800 and 390x844, in Chromium and WebKit, at device scale factor 1. Files are named `<browser>-<size>-<region>.png`.

| Region | Page | What changed |
| --- | --- | --- |
| `home-targets` | `/` | New item "Publish where your players are": web, itch.io, Ruken, desktop (Tauri, planned) |
| `home-boot-guide` | `/` (source explorer, Boot) | "the host handshake" in place of "the Ruken handshake" |
| `showcase` | `/showcase` | The starter alone; the reference-projects section is gone |
| `ai-boundaries` | `/ai#boundaries` | "Use Hosting, whatever the target" |
| `ai-csp` | `/ai#csp` | "Each target serves a game with its own headers. On Ruken, …" |
| `cheatsheet-hosting` | `/cheatsheet#hosting` | Hosting as one interface for every target; Ruken facts scoped to the Ruken target |
| `docs-overview` | `/docs/overview` | "for the web" plus the four targets; the reference-projects sentence is gone |
| `docs-security-csp` | `/docs/security-csp` | "Zero-Eval CSP & Host Security", target by target |
| `docs-capabilities` | `/docs/capabilities` | New section "Where a game goes" |
| `docs-faq` | `/docs/faq` | "Where can a game be published?" in place of "What is Ruken?" |

## What to check

- The four targets read as peers. Desktop is said to be planned, because the framework has not built it yet (ADR 0006, DIST rows).
- No page names FloorFifty or The Last Light. The capture read every page's text: 0 matches, and 0 px horizontal overflow, on all 40 images.
- `/inside` (the framework's `stack.md`), the example source viewers and `/llms-full.txt` still carry the framework's own words until the framework's STANDALONE.2 rewords them. They aren't pictured.
