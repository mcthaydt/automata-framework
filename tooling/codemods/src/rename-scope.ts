// The scope codemod: every package moves from the Owner's personal npm scope,
// `@mcthaydt`, to the project's organisation, `@automata`, before anything is published to npmjs.org.
//
// The names map one to one, so the codemod is a table of text rules rather than an import rewrite: package names
// appear in imports, `package.json`s, Markdown, YAML, shell lines and test expectations alike, and every one of them
// must change the same way.
//
//   @mcthaydt/automata          → @automata/framework   (the main package: its own word, not "automata" twice)
//   @mcthaydt/automata-<name>   → @automata/<name>      (sim, content, tools, the private packages, the site)
//   @mcthaydt/<tool>            → @automata/<tool>      (the private tooling packages: vitest-preset, release, …)
//   mcthaydt-automata-<version> → automata-framework-<version>   (`npm pack` file names: `@a/b` packs as `a-b-…tgz`)
//   mcthaydt-automata-<name>    → automata-<name>
//
// What stayed until the packages moved to npmjs.org: `@mcthaydt` as a registry scope (`.npmrc`, the release job's `scope:`), now gone;
// the GitHub owner in `mcthaydt/automata-framework` URLs and `CODEOWNERS`;
// and the history (`docs/archive/`, `docs/refactor/`, every `CHANGELOG.md`), which records the names as they were.
// Patterns written as regular expressions (`@mcthaydt\/automata(?:-…)?`) are rewritten by the same rules but encode
// the old naming scheme (main package = the bare prefix), so the CLI lists them for a person to check by eye.

/** The project's npm scope, without the `@`. */
export const NEW_SCOPE = 'automata'
/** The main package's name inside the scope. */
export const MAIN_PACKAGE = 'framework'

// One rule per line of the table above, tried in this order at each position; `\\?` keeps a regex's escaped slash.
const RULES: readonly { readonly pattern: RegExp; readonly to: string }[] = [
  { pattern: /@mcthaydt(\\?)\/automata-/g, to: `@${NEW_SCOPE}$1/` },
  { pattern: /@mcthaydt(\\?)\/automata(?![a-z0-9-])/g, to: `@${NEW_SCOPE}$1/${MAIN_PACKAGE}` },
  { pattern: /@mcthaydt(\\?)\/(?=[a-z*])/g, to: `@${NEW_SCOPE}$1/` },
  { pattern: /\bmcthaydt-automata-(?=\d)/g, to: `${NEW_SCOPE}-${MAIN_PACKAGE}-` },
  // `mcthaydt-automata-framework` is the GitHub repository's slug (a runner's service name), not a pack file.
  { pattern: /\bmcthaydt-automata-(?!framework\b)(?=[a-z])/g, to: `${NEW_SCOPE}-` },
]

/** `text` with every old package name in the new scope. */
export function renameScope(text: string): string {
  return RULES.reduce((result, rule) => result.replace(rule.pattern, rule.to), text)
}

/** True when `text` holds a regular-expression form of an old name, which the rules rewrite but a person checks. */
export function hasPatternForm(text: string): boolean {
  return /@mcthaydt\\\/automata(?!-)/.test(text)
}

// Where the old names stay on purpose: the history, which records them as they were, and the codemod and the
// repository check themselves, which must name what they replace.
const KEPT = [
  /^docs\/archive\//,
  /^docs\/refactor\//,
  /(^|\/)CHANGELOG\.md$/,
  // The changeset that tells users the old names became the new ones; it ends up in the changelogs.
  /^\.changeset\/scope-automata\.md$/,
  /^tooling\/codemods\/(src|tests\/unit)\/rename-scope(-cli)?(\.test)?\.ts$/,
  /^tooling\/release\/tests\/unit\/scope\.test\.ts$/,
]

/** True when the file at `path` (relative to the repository) keeps the old names. */
export function keepsOldNames(path: string): boolean {
  return KEPT.some((pattern) => pattern.test(path))
}
