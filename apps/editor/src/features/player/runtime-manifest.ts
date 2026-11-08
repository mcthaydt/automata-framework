import { frameworkCore, frameworkPackage } from '../../shared/framework-packages.ts'

// The runtime a phone carries: the framework's browser packages and the few a 2D game imports, already built, served
// to a game through an import map. A game is compiled against this list, so a game that names anything else is told
// so before it is run. `three` is not here on purpose: the phone does not run it.

/** One package entry of the runtime: the version it was built from and where the page finds it. */
export interface RuntimeEntry {
  readonly version: string
  /** A URL the played game can load, relative to the app's own origin or absolute. */
  readonly url: string
}

/** The runtime the app carries. Keys are the specifiers a game writes (`pixi.js`, `zod`, a framework entry). */
export interface RuntimeManifest {
  readonly packages: Readonly<Record<string, RuntimeEntry>>
}

/**
 * The specifiers the shipped runtime serves, sorted. A test reads Emberwick's and the 2D starter's imports against it,
 * and the build step of the runtime (a later task) turns each into a file and a manifest row.
 */
export const RUNTIME_SPECIFIERS: readonly string[] = [
  '@fontsource/pixelify-sans/latin-400.css',
  '@fontsource/pixelify-sans/latin-700.css',
  frameworkCore(),
  frameworkCore('no-eval'),
  frameworkCore('theme.css'),
  frameworkPackage('content', 'compile'),
  frameworkPackage('content', 'level-2d'),
  frameworkPackage('content', 'palette'),
  frameworkPackage('content', 'schema'),
  frameworkPackage('sim'),
  frameworkPackage('sim', 'hash'),
  frameworkPackage('sim', 'math'),
  'pixi.js',
  'pixi.js/unsafe-eval',
  'zod',
].sort()

/** The framework package whose version a game is checked against: every framework package shares it. */
export const FRAMEWORK_ENTRY: string = frameworkCore()
