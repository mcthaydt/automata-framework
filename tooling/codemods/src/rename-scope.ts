// The scope codemod: every package moves from `@automata`, an npm scope that belongs to another account, to the
// project's own organisation, `@automataframework`, before anything is published to npmjs.org. (The scope moved once
// before, from the Owner's personal `@mcthaydt`; that move is done and its names live only in the history.)
//
// The names map one to one, so the codemod is a table of text rules rather than an import rewrite: package names
// appear in imports, `package.json`s, Markdown, YAML, shell lines and test expectations alike, and every one of them
// must change the same way.
//
//   @automata/<name>           → @automataframework/<name>   (and the bare scope: `node_modules/@automata`, `'@automata'`)
//   automata-<name>-<ver>.tgz  → automataframework-<name>-<ver>.tgz   (`npm pack` file names: `@a/b` packs as `a-b-…tgz`)
//
// Look-alikes that are not the npm scope and stay: the `automata` command and the `automata-*` bins, the product name
// AutomataFramework, the repository slugs (`mcthaydt/automata-framework`, `mcthaydt/automata-skills`), the agent
// plugin's id `automata@automata-framework`, the root package `automata-framework`, `@af-games/*` and `@af-examples/*`,
// and the domain `automataframework.com`. Neither rule can match its own output (`@automataframework` has a letter
// after `@automata`; `automataframework-` has no `automata-`), so a second run changes nothing.

/** The project's npm scope, without the `@`. */
export const NEW_SCOPE = 'automataframework'

// Tried in this order. `(?![a-z0-9-])` stops at the end of the scope word, so `@automata/x`, `@automata\/x` (a regular
// expression's escaped slash), `'@automata'` and `node_modules/@automata` all match and `@automataframework` does not.
const RULES: readonly { readonly pattern: RegExp; readonly to: string }[] = [
  { pattern: /@automata(?![a-z0-9-])/g, to: `@${NEW_SCOPE}` },
  // A pack file name, or a pattern for one (`/automata-tools-.*\.tgz$/`): the name runs up to `.tgz` in one word.
  { pattern: /\bautomata-(?=[a-z0-9][a-z0-9.*\\-]*\.tgz)/g, to: `${NEW_SCOPE}-` },
]

/** `text` with every old package name in the new scope. */
export function renameScope(text: string): string {
  return RULES.reduce((result, rule) => result.replace(rule.pattern, rule.to), text)
}

/** How many old names `text` holds: the occurrences `renameScope` rewrites. */
export function oldNameCount(text: string): number {
  return RULES.reduce((count, rule) => count + (text.match(rule.pattern)?.length ?? 0), 0)
}

/** True when `text` holds a regular expression naming the old scope, which the rules rewrite but a person checks. */
export function needsALook(text: string): boolean {
  return /@automata\\\/|automata-[a-z0-9-]*\.\*/.test(text)
}

// Where the old names stay on purpose: the dated records (the archive, the refactor and superpowers records, which
// state what was true when they were written, such as "`@automata` belongs to another account"), the changelogs, the
// lockfile (`pnpm install` rewrites it from the `package.json`s; it is never edited by hand), and the codemod and the
// scope check themselves, which must name what they replace.
const KEPT = [
  /^docs\/archive\//,
  /^docs\/refactor\//,
  /^docs\/superpowers\//,
  /(^|\/)CHANGELOG\.md$/,
  /^pnpm-lock\.yaml$/,
  /^tooling\/codemods\/src\/rename-scope(-cli)?\.ts$/,
  /^tooling\/codemods\/tests\/unit\/(rename-scope|scope-hygiene)\.test\.ts$/,
]

/** True when the file at `path` (relative to the repository) keeps the old names. */
export function keepsOldNames(path: string): boolean {
  return KEPT.some((pattern) => pattern.test(path))
}
