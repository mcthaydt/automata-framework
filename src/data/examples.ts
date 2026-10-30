import examplesJson from './examples.json'

// The framework's one-file example catalog, as the sync writes it (scripts/sync-playground.ts; never edited by hand).

export interface Example {
  readonly id: string
  readonly module: string
  readonly name: string
  readonly title: string
  readonly shows: string
  readonly controls: string
  readonly packages: readonly string[]
  /** 1 to 4. */
  readonly difficulty: number
  readonly tier: string
  readonly golden?: { readonly ticks: number; readonly replay: string }
  /** Under the framework's examples/. */
  readonly path: string
  readonly source: string
  readonly codeLines: number
  /** The example's frame page under /playground/. */
  readonly framePage: string
  readonly moduleUrl: string
}

/** What the index and the example list need: no source. */
export type ExampleSummary = Pick<Example, 'id' | 'title' | 'shows' | 'difficulty'>
export interface ExampleGroup { readonly module: string; readonly examples: readonly ExampleSummary[] }

/** The order a reader meets the modules in: the sim and input first, drawing next, sound last. */
const MODULE_ORDER = ['core', 'shapes', 'textures', 'render', 'audio']

const EXAMPLES: readonly Example[] = examplesJson as Example[]

export function getExamples(): readonly Example[] {
  return EXAMPLES
}

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find(example => example.id === id)
}

export function exampleIndex(): ExampleGroup[] {
  const modules = [...new Set(EXAMPLES.map(example => example.module))]
  const rank = (module: string) => MODULE_ORDER.includes(module) ? MODULE_ORDER.indexOf(module) : MODULE_ORDER.length
  return modules
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(module => ({
      module,
      examples: EXAMPLES.filter(example => example.module === module).map(({ id, title, shows, difficulty }) => ({ id, title, shows, difficulty })),
    }))
}

/** Difficulty as the framework's headers write it: ★☆☆☆ is 1. */
export function difficultyStars(difficulty: number): string {
  return '★'.repeat(difficulty) + '☆'.repeat(Math.max(0, 4 - difficulty))
}
