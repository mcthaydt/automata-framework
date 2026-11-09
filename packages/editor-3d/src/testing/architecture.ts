import { posix } from 'node:path'
import { findImpurities } from './purity'

// The boundary between the headless editor and its views (ED3D-D1; plan ED3D.5c step 6), over a map of path (relative
// to `src/`) to source. A component's imports are in its `<script>`; this package's own code is all it reads, so a plain
// scan of the import statements is enough, and `purity.ts` already tells code from comments and strings.

export type Rule = 'components-in-ui' | 'headless-imports-view' | 'ui-through-app' | 'ui-clock'

export interface Violation {
  readonly file: string
  readonly rule: Rule
  readonly message: string
}

/** The page entries: the only files outside `ui/` that start the views (the editor's page and the full suite's). */
const ENTRIES: ReadonlySet<string> = new Set(['main.ts', 'suite-main.ts'])
/** Packages that are views: Svelte, the kit's Svelte root, the suite shell and the geometry owner. Svelte's and the geometry owner's sub-entries count too; the kit's headless ones (`kit/core`, `kit/fields`) do not. */
const VIEW_PACKAGES =
  /^(svelte(\/.*)?|@automataframework\/automata-editor\/(kit|suite)|@automataframework\/automata-ui(\/.*)?)$/
/** What the views must not read for themselves: the boot hands them a clock. */
const CLOCK =
  /^(Date|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|queueMicrotask|performance\.now|Math\.random)$/

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g

/** The code of a file: a component's scripts, or the whole of a module. */
function codeOf(file: string, source: string): string {
  if (!file.endsWith('.svelte')) return source
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1] ?? '')
    .join('\n')
}

function importsOf(code: string): { specifier: string; typeOnly: boolean }[] {
  return [...code.matchAll(IMPORT)].map((match) => ({
    specifier: match[2] ?? '',
    typeOnly: match[1] !== undefined,
  }))
}

const inUi = (file: string): boolean => file.startsWith('ui/')

/** Every rule `files` breaks, in file order. */
export function checkArchitecture(files: ReadonlyMap<string, string>): Violation[] {
  const violations: Violation[] = []
  for (const [file, source] of files) {
    const report = (rule: Rule, message: string): void => {
      violations.push({ file, rule, message })
    }
    if (file.endsWith('.svelte') && !inUi(file)) report('components-in-ui', 'components live in ui/')
    const code = codeOf(file, source)
    for (const { specifier, typeOnly } of importsOf(code)) {
      const relative = specifier.startsWith('.')
      const target = relative ? posix.normalize(posix.join(posix.dirname(file), specifier)) : specifier
      if (!inUi(file)) {
        if (ENTRIES.has(file)) continue
        const view =
          (relative && (inUi(target) || target.endsWith('.svelte'))) ||
          (!relative && VIEW_PACKAGES.test(specifier))
        if (view) report('headless-imports-view', `${specifier}: the headless layers import no view`)
      } else if (relative && !typeOnly && !inUi(target) && !target.startsWith('app/')) {
        report('ui-through-app', `${specifier}: ui/ reaches the editor through app/`)
      }
    }
    if (inUi(file)) {
      for (const found of findImpurities(code)) {
        if (CLOCK.test(found)) report('ui-clock', `${found}: the views take time from the boot's clock`)
      }
    }
  }
  return violations
}
