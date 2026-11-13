import examples from 'virtual:framework/examples'
import scenes from 'virtual:framework/scenes'
import type { PlaygroundExample } from '../../../playground/src/playground-catalog.ts'
import type { SceneExample } from './examples.ts'

// The framework's one-file example catalog, read from examples/2d when the site is built, and the 3D examples
// beside it, read from examples/3d (src/shared/framework/examples.ts). The 3D ones are their own group and their own
// type: they run in a frame the visitor starts, and their code is read-only.

export type Example = PlaygroundExample
export type { SceneExample }

/** What the index and the example list need: no source. */
export type ExampleSummary = Pick<Example, 'id' | 'title' | 'shows' | 'difficulty'>
export interface ExampleGroup {
  readonly module: string
  readonly examples: readonly ExampleSummary[]
}

/** The order a reader meets the modules in: the sim and input first, drawing next, sound last. */
const MODULE_ORDER = ['core', 'shapes', 'textures', 'render', 'audio']

/** The 3D set's module: its group closes the index, after every 2D group, whatever else is added. */
const SCENE_MODULE = 'scene'

/** What a group of examples is called on the site: the person's words, not the examples folder's. */
const MODULE_TITLES: Readonly<Record<string, string>> = {
  core: 'The basics',
  shapes: 'Drawing shapes',
  textures: 'Pictures and sprites',
  render: 'Looks and speed',
  audio: 'Sound',
  [SCENE_MODULE]: 'One small world, in 3D',
}

/** A group's heading: its plain name, or the folder's name with a capital for a group added later. */
export function moduleTitle(module: string): string {
  return MODULE_TITLES[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

const EXAMPLES: readonly Example[] = examples

export function getExamples(): readonly Example[] {
  return EXAMPLES
}

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((example) => example.id === id)
}

const SCENES: readonly SceneExample[] = scenes

/** The 3D examples the site shows: none until the kits they import are public. */
export function getScenes(): readonly SceneExample[] {
  return SCENES
}

export function getScene(id: string): SceneExample | undefined {
  return SCENES.find((scene) => scene.id === id)
}

/** The index's groups: every 2D module, then the 3D set's, each example without its source. */
export function exampleIndex(): ExampleGroup[] {
  const everything: readonly (Example | SceneExample)[] = [...EXAMPLES, ...SCENES]
  const modules = [...new Set(everything.map((example) => example.module))]
  const rank = (module: string) =>
    module === SCENE_MODULE
      ? MODULE_ORDER.length + 1
      : MODULE_ORDER.includes(module)
        ? MODULE_ORDER.indexOf(module)
        : MODULE_ORDER.length
  return modules
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((module) => ({
      module,
      examples: everything
        .filter((example) => example.module === module)
        .map(({ id, title, shows, difficulty }) => ({ id, title, shows, difficulty })),
    }))
}

/** Difficulty as the framework's headers write it: ★☆☆☆ is 1. */
export function difficultyStars(difficulty: number): string {
  return '★'.repeat(difficulty) + '☆'.repeat(Math.max(0, 4 - difficulty))
}
