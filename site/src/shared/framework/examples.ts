import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  isUnpublishedExtension,
  readCatalog,
  SET_MODULE,
  SET_PACKAGE,
} from '@automata/examples-runner/catalog'
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
  /**
   * The page the runner builds for it, as the site serves it (`buildScenes` in scripts/build-demos.ts): under its module,
   * where the runner writes it, because the page names its files relative to itself.
   */
  readonly frameUrl: string
  /** The Owner-approved still the page shows before Play, when there is one (`screenshots-approved.json`). */
  readonly still?: string
}

type Manifest = {
  readonly name?: string
  readonly private?: boolean
  readonly dependencies?: Record<string, string>
}
const manifestOf = (dir: string): Manifest | undefined => {
  const path = join(dir, 'package.json')
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest) : undefined
}

/**
 * Whether a stranger could not install what the set's own package depends on. The set is private content an example
 * may import, so its runtime dependencies ship in every example built on it: one that is an unpublished extension, or a
 * private workspace package, keeps every such example off the site, whatever the example's own file names.
 */
function setNeedsPrivate(root: string): boolean {
  const workspace = ['packages', 'extensions'].flatMap((group) => {
    const dir = join(root, group)
    return existsSync(dir) ? readdirSync(dir).map((name) => manifestOf(join(dir, name))) : []
  })
  const privateNames = new Set(
    workspace.filter((manifest) => manifest?.private === true).map((manifest) => manifest?.name),
  )
  const set = manifestOf(join(root, 'examples/set-3d'))
  return Object.keys(set?.dependencies ?? {}).some(
    (name) => isUnpublishedExtension(name) || privateNames.has(name),
  )
}

/**
 * The `scene` examples of the 3D examples folder (`dir`, from the repository root; absolute paths are kept) that the
 * site may show: valid ones that import no unpublished extension, the rule `playgroundCatalog` keeps for the 2D pages,
 * and none built on the set while the set itself depends on one (`setNeedsPrivate`).
 * While the 3D kits are private the real folder gives none, so the site gains no page. `AF_SITE_SCENES_DIR` names
 * another folder, for the one build that proves the pages on fixtures (tests/e2e/scene-examples.e2e.ts); nothing else reads it.
 */
export function sceneExamples(
  root: string = repositoryRoot,
  dir: string = process.env.AF_SITE_SCENES_DIR ?? 'examples/3d',
): SceneExample[] {
  // The set is the workspace's own package, wherever the examples folder is (a fixture folder has none of its own).
  const setIsPrivate = setNeedsPrivate(repositoryRoot)
  return readCatalog(resolve(root, dir))
    .filter((entry) => entry.module === SET_MODULE)
    .filter((entry) => entry.header !== undefined && entry.problems.length === 0)
    .filter((entry) => !entry.imports.some(isUnpublishedExtension))
    .filter((entry) => !(setIsPrivate && entry.imports.includes(SET_PACKAGE)))
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
        frameUrl: `/scenes/${entry.module}/${entry.name}/index.html`,
        ...(entry.screenshot === undefined ? {} : { still: `/scenes/stills/${entry.id}.png` }),
      }
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
