// The last step of `ui`'s published build (M2.4 spec §3.3, §3.4). `svelte-package` turns all of `src/` into
// `dist/`, tests included, and leaves `import type … from '@ruken/sdk'` in the declarations, which would not
// resolve in a game (Ruken is not published; D-8). So this:
//
// 1. removes test files, the test setup and the test-only fixture components from `dist/`;
// 2. rewrites each vendored specifier in a `.d.ts` to a relative path to the declarations tsdown inlined for it
//    (`tsdown.dts.config.ts` writes `dist/vendor/ruken-sdk.d.ts`).
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export interface FinishSvelteDistOptions {
  /** Vendored package name to the dist-relative `.js` path whose `.d.ts` holds its inlined types. */
  readonly vendoredTypes: Readonly<Record<string, string>>
}

/** `x.test.ts` output, `.test.svelte` harnesses, `vitest-setup`, and `*Fixture.svelte` test components. */
const TEST_ONLY = /(?:\.test\.|^vitest-setup\.|Fixture\.svelte)/

function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

/** `./vendor/ruken-sdk.js` or `../vendor/ruken-sdk.js`, as seen from `file`. */
function relativeSpecifier(dist: string, file: string, target: string): string {
  const path = relative(dirname(file), join(dist, target)).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

export function finishSvelteDist(dist: string, options: FinishSvelteDistOptions): void {
  for (const file of filesBelow(dist)) {
    const name = file.slice(file.lastIndexOf(sep) + 1)
    if (TEST_ONLY.test(name)) rmSync(file)
  }
  for (const file of filesBelow(dist).filter((path) => path.endsWith('.d.ts'))) {
    let text = readFileSync(file, 'utf8')
    for (const [name, target] of Object.entries(options.vendoredTypes)) {
      // Only the exact specifier in quotes, so `@ruken/sdk-host` is not taken for `@ruken/sdk`.
      const quoted = new RegExp(`(['"])${escapeRegExp(name)}\\1`, 'g')
      text = text.replace(
        quoted,
        (_match, quote: string) => `${quote}${relativeSpecifier(dist, file, target)}${quote}`,
      )
    }
    writeFileSync(file, text)
  }
}
