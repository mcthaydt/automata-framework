// Where a game goes (ADR 0006: web, itch.io, Ruken and desktop are peer targets). One sentence for every page that says
// so, read by the homepage, the docs and llms.txt; scripts/site-checks.ts `checkTargets` holds them to the four.
// True at framework.ref: automata-ship publishes to `ruken` and `itch`, a web build is static files, and the desktop
// build is planned (DIST rows).
export const DISTRIBUTION_TARGETS =
  'A game builds for any static web host, for itch.io or for Ruken (automata-ship publishes to the last two), and a desktop build (Tauri) for Windows, macOS and Linux is planned.'
