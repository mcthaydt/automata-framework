import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readCatalog } from '@automata/examples-runner/catalog'
import { type PlaygroundExample, playgroundCatalog } from '../../../playground/src/playground-catalog.ts'
import { repositoryRoot } from './root.ts'

// The examples and the feature demos come from the 2D examples package (examples/2d), the public one: the 3D
// examples are their own package and never reach the site while the 3D packages are private.

/** A feature demo: a small package of its own inside an examples module (`content/hot-reload`). */
export interface FeatureDemo {
  readonly slug: string
  readonly module: string
  /** From the examples folder: `content/hot-reload`. */
  readonly path: string
}

const examplesDir = (root: string) => join(root, 'examples/2d')

/**
 * Every example the playground runs, as the examples pages show it: the 2D catalog's valid examples, each with its
 * source, its frame page and its golden (playground/src/playground-catalog.ts).
 */
export function playgroundExamples(root: string = repositoryRoot): PlaygroundExample[] {
  return playgroundCatalog(readCatalog(examplesDir(root)), (entry) => readFileSync(entry.file, 'utf8'))
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
