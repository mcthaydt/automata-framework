// The one tsdown setup every published package builds with. Each package's
// `tsdown.config.ts` names only its entries, its platform and the Ruken packages it bundles.
//
// - ESM only, `target: 'es2022'`, `.js`/`.d.ts` names (never `.mjs`), declarations written by oxc from
//   isolatedDeclarations, so TypeScript's JS API (which TypeScript 7 lacks) is never needed.
// - The package's `dependencies` and `peerDependencies` stay external. Its devDependencies are bundled, and the
//   vendored `@ruken/*` tarballs are devDependencies, so Ruken code is bundled and its types inlined (D-8).
// - `onlyBundle` fails the build if anything but the named Ruken packages would be bundled from node_modules,
//   and `onlyImport` fails it if the output imports a package that is not a declared dependency. Together they
//   keep "external = dependencies" and "bundle Ruken" from ever disagreeing.
// - A package that bundles Ruken gets a `VENDORED.md` naming the Ruken commit and tarball hashes.
// - `unbundle` mirrors the source tree, one output file per module, for a package with Svelte rune modules
//: a game's Svelte plugin compiles only files named `*.svelte.js`, so a `.svelte.ts` module
//   inlined into a bundle would throw `$state is not defined` in the game.
// - `rukenTypes` are vendored packages the package imports types from, and nothing else. They stay imports in
//   the declarations here; a declarations-only pass inlines them into `dist/vendor/` and `finishSvelteDist` points
//   the imports there (ui's layout), because an unbundled build would otherwise copy them under
//   `dist/node_modules/`, which npm never publishes.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { writeVendored } from './write-vendored.ts'

export interface PublishedBuildOptions {
  /** Output name (without extension) to source file, e.g. `{ index: 'src/index.ts' }`. */
  readonly entry: Readonly<Record<string, string>>
  /** `browser` for code that runs in a game, `node` for build-time tools. */
  readonly platform: 'browser' | 'node'
  /** The vendored Ruken packages this package bundles; each must be a devDependency. */
  readonly bundleRuken?: readonly string[]
  /** Extra files copied into `dist` (tsdown's `copy`). */
  readonly copy?: UserConfig['copy']
  /** One output file per source module instead of one bundle per entry (see the header). */
  readonly unbundle?: boolean
  /**
   * Vendored Ruken packages imported for their types only, inlined by a later declarations pass (see the header).
   * The build allows them as imports, so a value import would build; `test:dist`'s D-8 check, not `pnpm check`,
   * catches one.
   */
  readonly rukenTypes?: readonly string[]
}

interface Manifest {
  readonly name: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

const root = fileURLToPath(new URL('../../..', import.meta.url))

const escapeRegExp = (name: string): string => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** `@ruken/sdk` matches `@ruken/sdk` and `@ruken/sdk/testing`, never `@ruken/sdk-host`. */
const packageAndSubpaths = (name: string): RegExp => new RegExp(`^${escapeRegExp(name)}(?:/|$)`)

/** `configUrl` is the package's `import.meta.url` from its `tsdown.config.ts`. */
export function publishedBuild(configUrl: string, options: PublishedBuildOptions): UserConfig {
  const packageDir = fileURLToPath(new URL('.', configUrl))
  const manifest = JSON.parse(readFileSync(new URL('./package.json', configUrl), 'utf8')) as Manifest
  const external = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]
  const bundleRuken = options.bundleRuken ?? []
  const rukenTypes = (options.rukenTypes ?? []).map(packageAndSubpaths)

  return {
    entry: { ...options.entry },
    format: 'esm',
    platform: options.platform,
    target: 'es2022',
    fixedExtension: false,
    dts: { eager: true },
    deps: {
      onlyBundle: bundleRuken.map(packageAndSubpaths),
      ...(rukenTypes.length === 0 ? {} : { neverBundle: rukenTypes }),
      // Node built-ins stay external and are always allowed: a browser-platform package may still reach for
      // them behind a runtime guard (e.g. `@mcthaydt/automata-sim/testing` reads files in Node, and reads
      // golden files through a Vitest command in a browser).
      onlyImport: [...external.map(packageAndSubpaths), ...rukenTypes, /^node:/],
    },
    ...(options.copy === undefined ? {} : { copy: options.copy }),
    ...(options.unbundle === true ? { unbundle: true } : {}),
    hooks: {
      'build:done': () => {
        if (bundleRuken.length > 0) {
          writeVendored({ root, packageDir, packageName: manifest.name, bundled: bundleRuken })
        }
      },
    },
  }
}
