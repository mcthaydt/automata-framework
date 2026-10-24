/**
 * String literals only the Ruken SDK contains, which survive minification (PUB spec §3): the SDK's storage probe
 * key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp b30d31b. An `itch` or
 * `web` build must contain neither, because it bundles the web adapter instead of the SDK; a `ruken` build
 * contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.
 *
 * Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.
 */
export const RUKEN_SDK_MARKERS: readonly string[] = ['ruken:__probe__', 'needs the Ruken host']

/** The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code. */
export function findRukenSdkMarkers(code: string): string[] {
  return RUKEN_SDK_MARKERS.filter((marker) => code.includes(marker))
}
