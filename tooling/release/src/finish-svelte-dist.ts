// The last step of `ui`'s published build (M2.4 spec §3.3, §3.4). `svelte-package` turns all of `src/` into
// `dist/`, tests included, and leaves `import type … from '@ruken/sdk'` in the declarations, which would not
// resolve in a game (Ruken is not published; D-8). So this:
//
// 1. removes test files, the test setup and the test-only fixture components and modules from `dist/`;
// 2. rewrites each vendored specifier in a `.d.ts` to a relative path to the declarations tsdown inlined for it
//    (`tsdown.dts.config.ts` writes `dist/vendor/ruken-sdk.d.ts`);
// 3. gives every relative import in `.js` and `.d.ts` a file extension. `src/` imports without one (`'./layout'`)
//    because Vite resolves it, but Node's ESM loader and TypeScript's nodenext resolution need the exact file.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export interface FinishSvelteDistOptions {
  /** Vendored package name to the dist-relative `.js` path whose `.d.ts` holds its inlined types. */
  readonly vendoredTypes: Readonly<Record<string, string>>
}

/**
 * `x.test.ts` output, `.test.svelte` harnesses, `vitest-setup`, `*Fixture.svelte` test components and the
 * `*-fixture.ts` modules they share (which may import a dev dependency, such as ui's `locale-fixture.ts`).
 */
const TEST_ONLY = /(?:\.test\.|^vitest-setup\.|Fixture\.svelte|-fixture\.)/

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

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/**
 * The specifier Node would need for `specifier` imported from `file`: unchanged when it already names a file
 * (`./Dialog.svelte`, `./theme.css`), `+ '.js'` when the output is a module or a declaration-only module
 * (`./input-method.svelte` → `./input-method.svelte.js`), `+ '/index.js'` for a folder. Anything else is
 * left alone, and the dist checks catch it.
 */
function withExtension(file: string, specifier: string): string {
  const target = join(dirname(file), specifier)
  if (isFile(target)) return specifier
  if (isFile(`${target}.js`) || isFile(`${target}.d.ts`)) return `${specifier}.js`
  if (isFile(join(target, 'index.js')) || isFile(join(target, 'index.d.ts'))) return `${specifier}/index.js`
  return specifier
}

/** `from './x'`, `import './x'` and `import('./x')`, with either quote. */
const RELATIVE_IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]*)\2/g

function addExtensions(file: string, text: string): string {
  return text.replace(
    RELATIVE_IMPORT,
    (_match, lead: string, quote: string, specifier: string) =>
      `${lead}${quote}${withExtension(file, specifier)}${quote}`,
  )
}

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
  for (const file of filesBelow(dist).filter((path) => path.endsWith('.js') || path.endsWith('.d.ts'))) {
    writeFileSync(file, addExtensions(file, readFileSync(file, 'utf8')))
  }
}
