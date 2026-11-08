// The origins the app's pages run from, written as the strings a browser sends. The URL class reports a custom
// scheme's origin as "null", so these are never built through it, and callers compare them as strings.

export type AppPlatform = 'macos' | 'ios' | 'linux' | 'windows' | 'android'

export interface AppOrigins {
  /** The editor page. */
  readonly page: string
  /** The game, served by the play scheme from `.automata/play/`: a different origin from the page, on purpose. */
  readonly game: string
}

const WITH_SCHEME: AppOrigins = { page: 'tauri://localhost', game: 'automata-game://localhost' }
const WITH_HTTP: AppOrigins = { page: 'http://tauri.localhost', game: 'http://automata-game.localhost' }

/** Windows and Android serve a custom scheme as http on a `.localhost` name; the others use the scheme itself. */
export const APP_ORIGINS: Readonly<Record<AppPlatform, AppOrigins>> = {
  macos: WITH_SCHEME,
  ios: WITH_SCHEME,
  linux: WITH_SCHEME,
  windows: WITH_HTTP,
  android: WITH_HTTP,
}

/** The page origins the sidecar must answer: every platform's, since one build of the server runs on each. */
export const PAGE_ORIGINS: readonly string[] = [
  ...new Set(Object.values(APP_ORIGINS).map((each) => each.page)),
]
