// Where a game goes (ADR 0006: web, itch.io, Ruken and desktop are peer targets). One sentence for every page that says
// so, read by the homepage, the docs and llms.txt; scripts/site-checks.ts `checkTargets` holds them to the four.
// True of `automata ship`: `prepare --target web` checks a static build, `publish` sends it to itch.io or Ruken, and
// `prepare --target tauri` builds the desktop app that `publish --target itch --from tauri` uploads.
export const DISTRIBUTION_TARGETS =
  'A game builds for any static web host, for itch.io, for Ruken, or as a desktop app (Tauri) for Windows, macOS and Linux; automata ship checks and publishes each.'
