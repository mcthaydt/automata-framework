/**
 * String literals only the Ruken SDK contains, which survive minification (PUB spec §3): the SDK's storage probe
 * key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at
 * b30d31b). An `itch` or `web` build must contain neither, because it bundles the web adapter instead of the SDK;
 * a `ruken` build contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.
 *
 * Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.
 */
export const RUKEN_SDK_MARKERS: readonly string[] = ['ruken:__probe__', 'needs the Ruken host']

/** The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code. */
export function findRukenSdkMarkers(code: string): string[] {
  return RUKEN_SDK_MARKERS.filter((marker) => code.includes(marker))
}

/**
 * String literals only Tauri's IPC code contains, which survive minification: the global the webview injects
 * (`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`). A `tauri` build holds
 * both; a `web`, `itch` or `ruken` build holds neither (DIST spec §5.3). Re-check them after a Tauri upgrade:
 * `target.build.test.ts` fails if a `tauri` build stops containing them.
 */
export const TAURI_MARKERS: readonly string[] = ['__TAURI_INTERNALS__', 'plugin:process|exit']

/** The Tauri markers found in `code` (built JavaScript), each named once; empty means no Tauri IPC code. */
export function findTauriMarkers(code: string): string[] {
  return TAURI_MARKERS.filter((marker) => code.includes(marker))
}
