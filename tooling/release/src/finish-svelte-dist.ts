// The last step of the published build of a package with Svelte code: `ui` and `game` (after `svelte-package`)
// and `runtime` (after tsdown's unbundled build) (M2.4 spec §3.3, §3.4; DX.2a). `svelte-package` turns all of
// `src/` into `dist/`, tests included, and both tools leave `import … from '@ruken/…'` in place, which would not
// resolve in a game (Ruken is not published; D-8). So this:
//
// 1. removes test files, the test setup, the test-only fixture components and the package's own test-only
//    folders (`testOnly`) from `dist/`;
// 2. rewrites each vendored specifier to a relative path to what tsdown wrote for it under `dist/vendor/`: in a
//    `.d.ts` for a package whose Ruken imports are types only (`vendoredTypes`), in `.js` and `.d.ts` for one
//    whose Ruken code is bundled there (`vendoredCode`, game's `SLUG_RE`);
// 3. gives every relative import in `.js` and `.d.ts` a file extension. `src/` imports without one (`'./layout'`)
//    because Vite resolves it, but Node's ESM loader and TypeScript's nodenext resolution need the exact file. A
//    `./x.ts` specifier (game's sources import with `.ts`; svelte-package rewrites it only in JavaScript) becomes
//    the `./x.js` it was emitted as.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export interface FinishSvelteDistOptions {
  /** Vendored package name to the dist-relative `.js` path whose `.d.ts` holds its inlined types. */
  readonly vendoredTypes: Readonly<Record<string, string>>
  /** Vendored package name to the dist-relative `.js` file its bundled code is in; rewritten in `.js` and `.d.ts`. */
  readonly vendoredCode?: Readonly<Record<string, string>>
  /** Dist-relative folders that hold test helpers only (game's `input/testing`); removed. */
  readonly testOnly?: readonly string[]
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
  if (/\.ts$/.test(specifier) && !specifier.endsWith('.d.ts')) {
    const emitted = target.replace(/\.ts$/, '')
    if (isFile(`${emitted}.js`) || isFile(`${emitted}.d.ts`)) return specifier.replace(/\.ts$/, '.js')
  }
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

/** Each vendored specifier in `text` rewritten to its file under `dist`, relative to `file`. */
function pointAtVendored(
  dist: string,
  file: string,
  text: string,
  vendored: Readonly<Record<string, string>>,
): string {
  let result = text
  for (const [name, target] of Object.entries(vendored)) {
    // Only the exact specifier in quotes, so `@ruken/sdk-host` is not taken for `@ruken/sdk`.
    const quoted = new RegExp(`(['"])${escapeRegExp(name)}\\1`, 'g')
    result = result.replace(
      quoted,
      (_match, quote: string) => `${quote}${relativeSpecifier(dist, file, target)}${quote}`,
    )
  }
  return result
}

export function finishSvelteDist(dist: string, options: FinishSvelteDistOptions): void {
  for (const folder of options.testOnly ?? []) rmSync(join(dist, folder), { recursive: true, force: true })
  for (const file of filesBelow(dist)) {
    const name = file.slice(file.lastIndexOf(sep) + 1)
    if (TEST_ONLY.test(name)) rmSync(file)
  }
  const vendoredCode = options.vendoredCode ?? {}
  for (const file of filesBelow(dist).filter((path) => path.endsWith('.js') || path.endsWith('.d.ts'))) {
    const vendored = file.endsWith('.d.ts') ? { ...options.vendoredTypes, ...vendoredCode } : vendoredCode
    writeFileSync(file, pointAtVendored(dist, file, readFileSync(file, 'utf8'), vendored))
  }
  for (const file of filesBelow(dist).filter((path) => path.endsWith('.js') || path.endsWith('.d.ts'))) {
    writeFileSync(file, addExtensions(file, readFileSync(file, 'utf8')))
  }
}
