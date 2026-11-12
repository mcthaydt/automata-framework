import type { PlaygroundRuntime } from './frame-page.ts'

// What an example may import in the playground, in one place: the compile step refuses every other name, and the
// frame's import map answers each of these. Each name the map answers is one file of the runtime build, so a name
// listed here that the map did not answer would compile and then fail to load in the frame.

/**
 * The screens `@automataframework/ui-screens` publishes as code (its package's `exports`, `words/*` apart). The playground's one
 * screens chunk holds them all, so each name is mapped to that chunk; the test reads the package and fails when a
 * screen is published that is not listed here.
 */
const UI_SCREENS = [
  '@automataframework/ui-screens',
  '@automataframework/ui-screens/credits',
  '@automataframework/ui-screens/error',
  '@automataframework/ui-screens/loading',
  '@automataframework/ui-screens/results',
  '@automataframework/ui-screens/splash',
  '@automataframework/ui-screens/title',
] as const

/** Every module name an example may import. */
export const PLAYGROUND_IMPORT_LIST: readonly string[] = [
  '@automataframework/framework',
  'zod',
  ...UI_SCREENS,
]

const ALLOWED: ReadonlySet<string> = new Set(PLAYGROUND_IMPORT_LIST)

/** Whether an example may import `specifier`. */
export const isPlaygroundImport = (specifier: string): boolean => ALLOWED.has(specifier)

/** The frame's import map: each importable name to the runtime file that serves it. */
export function playgroundImportMap(
  runtime: Pick<PlaygroundRuntime, 'automata' | 'zod' | 'uiScreens'>,
): Record<string, string> {
  const map: Record<string, string> = { '@automataframework/framework': runtime.automata, zod: runtime.zod }
  for (const name of UI_SCREENS) map[name] = runtime.uiScreens
  return map
}
