import type { ShipConfig } from '../../config/ship-config.ts'
import { type TauriConfig, tauriConfigSchema } from '../../config/tauri-config.schema.ts'

// The desktop build's checks. Each returns the problems it found, as lines a person can act on;
// none means the check passed.

/** The game's `tauri` section, checked, or the problems that stop a desktop build. */
export function tauriSettings(config: ShipConfig): { settings?: TauriConfig; problems: string[] } {
  if (config.tauri === undefined) {
    return {
      problems: ['ship.config.ts has no tauri section: add tauri: { identifier: "dev.example.your-game" }'],
    }
  }
  const parsed = tauriConfigSchema.safeParse(config.tauri)
  if (!parsed.success) {
    return { problems: parsed.error.issues.map((issue) => `tauri.${issue.path.join('.')}: ${issue.message}`) }
  }
  return { settings: parsed.data, problems: [] }
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/** Tauri (and the platforms' installers) take a semver version (https://v2.tauri.app/reference/config/#version). */
export function checkTauriVersion(version: string): string[] {
  return SEMVER.test(version) ? [] : [`game.version "${version}" is not semver (major.minor.patch)`]
}

/** The webview loads `index.html` from the build's root, so the entry must be that file and it must exist. */
export function checkTauriEntry(files: readonly string[], entry: string): string[] {
  if (entry !== 'index.html') {
    return [`game.entry is "${entry}": the desktop build loads index.html, so the entry must be index.html`]
  }
  return files.includes('index.html') ? [] : ['index.html is missing from the build root']
}

/**
 * The webview's Content-Security-Policy: the shape of Ruken's no-eval policy, Tauri's IPC origins in `connect-src`
 * (https://v2.tauri.app/security/csp/), and the origins the game declares in `network.connect`. Tauri adds its own
 * hashes and nonces when it serves the page.
 */
export function tauriCsp(config: ShipConfig): string {
  const connect = ['ipc:', 'http://ipc.localhost', ...config.network.connect].join(' ')
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')
}

/** Every directive of `csp` that allows `'unsafe-eval'` (the quoted keyword; `'wasm-unsafe-eval'` is allowed). */
export function findEvalInCsp(csp: string): string[] {
  return csp
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive.split(/\s+/).includes("'unsafe-eval'"))
    .map(
      (directive) =>
        `the CSP allows 'unsafe-eval' (${directive.split(/\s+/)[0]}): every web build runs without eval`,
    )
}
