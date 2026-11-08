// The one place the app writes the framework's package names. The `@automataframework` rename (audit A5) is an edit
// here and nowhere else; a test fails when another file writes the name.

/** The name every framework package starts with: `@mcthaydt/automata` and `@mcthaydt/automata-<name>`. */
export const FRAMEWORK_PREFIX = '@mcthaydt/automata'

/** The browser package, or one of its entries: `frameworkCore('no-eval')`. */
export const frameworkCore = (entry?: string): string =>
  entry === undefined ? FRAMEWORK_PREFIX : `${FRAMEWORK_PREFIX}/${entry}`

/** A framework package by its short name, or one of its entries: `frameworkPackage('content', 'level-2d')`. */
export const frameworkPackage = (name: string, entry?: string): string =>
  entry === undefined ? `${FRAMEWORK_PREFIX}-${name}` : `${FRAMEWORK_PREFIX}-${name}/${entry}`
