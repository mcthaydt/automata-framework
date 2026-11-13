import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isUnpublishedExtension, readCatalog, SET_MODULE } from '@automata/examples-runner/catalog'
import { type PlaygroundExample, playgroundCatalog } from '../../../playground/src/playground-catalog.ts'
import { repositoryRoot } from './root.ts'

// The examples and the feature demos come from the 2D examples package (examples/2d), the public one. The 3D examples
// are their own package (examples/3d) and reach the site only through `sceneExamples`, which leaves out whatever
// imports a package a stranger could not install.

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

/**
 * One 3D example as its page shows it: the words, the controls and the code, read-only, around a frame that loads only
 * when the visitor presses Play. No golden and no determinism row: a `scene` example has no `Golden:` header, and the
 * story's hash is checked in its own journey.
 */
export interface SceneExample {
  readonly id: string
  /** Always `scene`: the module the page groups it under. */
  readonly module: string
  readonly name: string
  readonly title: string
  readonly shows: string
  readonly controls: string
  readonly packages: readonly string[]
  readonly difficulty: 1 | 2 | 3 | 4
  readonly tier: 'core' | 'extension'
  readonly path: string
  /** The file as written, header included. */
  readonly source: string
  readonly codeLines: number
  /** The page the runner builds for it, as the site serves it (`buildScenes` in scripts/build-demos.ts). */
  readonly frameUrl: string
  /** The Owner-approved still the page shows before Play, when there is one (`screenshots-approved.json`). */
  readonly still?: string
}

/**
 * The `scene` examples of the 3D examples folder (`dir`, from the repository root; absolute paths are kept) that the
 * site may show: valid ones that import no unpublished extension, the rule `playgroundCatalog` keeps for the 2D pages.
 * While the 3D kits are private the real folder gives none, so the site gains no page.
 */
export function sceneExamples(root: string = repositoryRoot, dir = 'examples/3d'): SceneExample[] {
  return readCatalog(resolve(root, dir))
    .filter((entry) => entry.module === SET_MODULE)
    .filter((entry) => entry.header !== undefined && entry.problems.length === 0)
    .filter((entry) => !entry.imports.some(isUnpublishedExtension))
    .map((entry) => {
      const header = entry.header as NonNullable<typeof entry.header>
      return {
        id: entry.id,
        module: entry.module,
        name: entry.name,
        title: header.title,
        shows: header.shows,
        controls: header.controls,
        packages: header.packages,
        difficulty: header.difficulty,
        tier: header.tier,
        path: entry.path,
        source: readFileSync(entry.file, 'utf8'),
        codeLines: entry.codeLines,
        frameUrl: `/scenes/${entry.name}/index.html`,
        ...(entry.screenshot === undefined ? {} : { still: `/scenes/stills/${entry.id}.png` }),
      }
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
