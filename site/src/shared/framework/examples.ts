import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readCatalog } from '@mcthaydt/examples-runner/catalog'
import { repositoryRoot } from './root.ts'

// The examples and the feature demos come from the 2D examples package (examples/2d), the public one: the 3D
// examples are their own package and never reach the site while the 3D packages are private.

/** One-file example, as the examples runner's catalog reads it. */
export interface ExampleItem {
  readonly id: string
  readonly module: string
  /** From the examples folder: `shapes/shapes-rects.ts`. */
  readonly path: string
  /** Where the examples runner serves it: `/shapes/rects/`. */
  readonly url: string
  /** The header's `Shows:` line. */
  readonly shows: string
}

/** A feature demo: a small package of its own inside an examples module (`content/hot-reload`). */
export interface FeatureDemo {
  readonly slug: string
  readonly module: string
  /** From the examples folder: `content/hot-reload`. */
  readonly path: string
}

const examplesDir = (root: string) => join(root, 'examples/2d')

/** Every valid example in the 2D catalog, in the catalog's order. */
export function exampleList(root: string = repositoryRoot): ExampleItem[] {
  return readCatalog(examplesDir(root))
    .filter((entry) => entry.problems.length === 0)
    .map((entry) => ({
      id: entry.id,
      module: entry.module,
      path: entry.path,
      url: entry.url,
      shows: entry.header?.shows ?? '',
    }))
}

/** Every `examples/2d/<module>/<demo>/` that has its own package.json, by path. */
export function featureDemos(root: string = repositoryRoot): FeatureDemo[] {
  const dir = examplesDir(root)
  return readdirSync(dir, { withFileTypes: true })
    .filter((module) => module.isDirectory() && module.name !== 'node_modules')
    .flatMap((module) =>
      readdirSync(join(dir, module.name), { withFileTypes: true })
        .filter((demo) => demo.isDirectory() && existsSync(join(dir, module.name, demo.name, 'package.json')))
        .map((demo) => ({ slug: demo.name, module: module.name, path: `${module.name}/${demo.name}` })),
    )
    .sort((a, b) => a.path.localeCompare(b.path))
}
