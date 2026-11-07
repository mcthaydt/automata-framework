// The tables the sim's determinism rules read (law 5): what a sim file may not name, which `Math` it may call, and
// which packages it may import. `check.ts` applies them to the syntax tree.

/** No I/O, no wall clock, no host APIs (law 5). */
export const BANNED_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'self',
  'document',
  'navigator',
  'location',
  'history',
  'console',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'crypto',
  'process',
  'globalThis',
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'setImmediate',
  'eval',
  'Function',
  'Intl', // ICU data differs per engine and version
  'WeakRef', // observes garbage collection timing
  'FinalizationRegistry',
  'SharedArrayBuffer', // shared memory between threads
  'Atomics',
])

/**
 * Members that reach a banned global without naming it: `(() => {}).constructor` is `Function`, so
 * `.constructor('return Date.now()')` would run code hidden in a string.
 */
export const BANNED_MEMBERS: ReadonlySet<string> = new Set(['constructor'])

/** Math members that IEEE-754 / ECMAScript define exactly. Everything else is engine-dependent. */
export const MATH_ALLOWED: ReadonlySet<string> = new Set([
  'sqrt',
  'fround',
  'round',
  'floor',
  'ceil',
  'trunc',
  'abs',
  'min',
  'max',
  'sign',
  'imul',
])

/** `Object`/`Reflect` members that list keys in an engine-dependent order. */
export const KEY_ENUMERATION: ReadonlySet<string> = new Set([
  'keys',
  'values',
  'entries',
  'getOwnPropertyNames',
  'getOwnPropertySymbols',
])

/** Locale/ICU-dependent methods: checked on any receiver, since the receiver's type is unknown to the AST. */
export const LOCALE_METHODS: ReadonlySet<string> = new Set([
  'localeCompare',
  'toLocaleString',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'toLocaleDateString',
  'toLocaleTimeString',
])

/** The packages a sim file may import, by exact name. */
export const IMPORT_ALLOWED: ReadonlySet<string> = new Set([
  'koota',
  'zod',
  '@dimforge/rapier2d-deterministic-compat',
  '@dimforge/rapier3d-deterministic-compat',
  // The sim's public entry points, for sim plugins in other packages (packages/physics). They are checked
  // sources themselves; deep imports into the sim's internals stay banned.
  '@automata/sim',
  '@automata/sim/hash',
  '@automata/sim/math',
])
