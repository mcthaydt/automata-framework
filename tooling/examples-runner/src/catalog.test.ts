import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type CatalogEntry, readCatalog } from './catalog.ts'

const fixtures = fileURLToPath(new URL('./fixtures/catalog/', import.meta.url))
const catalog = readCatalog(fixtures, { deliveryPlan: `${fixtures}delivery-plan.md` })
const entry = (path: string): CatalogEntry => {
  const found = catalog.find((candidate) => candidate.path === path)
  if (found === undefined) throw new Error(`${path} is not in the catalog`)
  return found
}

describe('readCatalog', () => {
  it('finds every example file, skipping old demo packages', () => {
    expect(catalog.map((candidate) => candidate.path)).toEqual([
      'core/core-both-done.ts',
      'core/core-both.ts',
      'core/core-deep.ts',
      'core/core-done.ts',
      'core/core-future-ready.ts',
      'core/core-future.ts',
      'core/core-game.ts',
      'core/core-ghost.ts',
      'core/core-good.ts',
      'core/core-headless.ts',
      'core/core-long.ts',
      'core/core-private.ts',
      'core/core-relative.ts',
      'core/core-renamed.ts',
      'core/core-schema.ts',
      'core/core-shot.ts',
      'core/core-waiting.ts',
      'core/misplaced.ts',
      'widgets/widgets-spin.ts',
    ])
  })

  it('accepts a valid example and says where the runner serves it', () => {
    expect(entry('core/core-good.ts')).toMatchObject({
      id: 'core-good',
      module: 'core',
      name: 'good',
      url: '/core/good/',
      codeLines: 2,
      imports: ['@mcthaydt/automata-sim'],
      problems: [],
    })
  })

  it('carries a screenshot only when it is approved', () => {
    expect(entry('core/core-good.ts').screenshot).toBe('core/core-good.png')
    expect(entry('core/core-shot.ts').screenshot).toBeUndefined()
  })

  it('accepts a pending example whose task is still open, and marks it pending', () => {
    expect(entry('core/core-waiting.ts')).toMatchObject({ problems: [], header: { pending: 'OPEN.1' } })
  })

  it('accepts zod, the schema language every command takes', () => {
    expect(entry('core/core-schema.ts')).toMatchObject({
      problems: [],
      imports: ['@mcthaydt/automata-sim', 'zod'],
    })
  })

  // G-1 (DX.2 plan): the game package is private until runtime and render-pixi publish, yet it is the
  // examples' one entry point, so it is the one private package an example may import.
  it('accepts the game package, private until its dependencies publish', () => {
    expect(entry('core/core-game.ts')).toMatchObject({ problems: [], imports: ['@mcthaydt/automata-game'] })
  })

  it('accepts a pending example importing the package its task will add', () => {
    expect(entry('core/core-future.ts')).toMatchObject({ problems: [], header: { pending: 'OPEN.1' } })
  })

  it('accepts a pending example that waits for several open tasks', () => {
    expect(entry('core/core-both.ts')).toMatchObject({ problems: [], header: { pending: 'OPEN.1, OPEN.2' } })
  })

  it.each([
    ['core/misplaced.ts', 'must be <module>/<module>-<name>.ts'],
    ['widgets/widgets-spin.ts', '"widgets" is not a module'],
    ['core/core-long.ts', '101 code lines, over the budget of 100'],
    ['core/core-relative.ts', 'import "./core-good.ts" is relative'],
    ['core/core-future-ready.ts', 'import "@mcthaydt/automata-future" is not a public entry'],
    ['core/core-deep.ts', 'import "@mcthaydt/automata-sim/src/world/sim" is not a public entry'],
    ['core/core-private.ts', 'import "@mcthaydt/automata-render-pixi" is not a public entry'],
    ['core/core-shot.ts', 'core/core-shot.png is not in screenshots-approved.json'],
    ['core/core-done.ts', 'Pending: DONE.1 is ticked in the delivery plan; remove the Pending line'],
    ['core/core-ghost.ts', 'Pending: NOPE.9 is not a task in the delivery plan'],
    [
      'core/core-both-done.ts',
      'Pending: DONE.1 is ticked in the delivery plan; remove it from the Pending line',
    ],
    ['core/core-headless.ts', 'line 1: Shows: is required'],
    ['core/core-renamed.ts', 'the title line names "core-other", not "core-renamed"'],
  ])('%s fails: %s', (path, problem) => {
    expect(entry(path).problems).toContain(problem)
    // Each bad fixture fails for its own reason only.
    expect(entry(path).problems.length, entry(path).problems.join('\n')).toBe(
      path === 'core/core-headless.ts' ? 5 : 1,
    )
  })
})

describe('the real examples', () => {
  it('pass the catalog', () => {
    const examples = fileURLToPath(new URL('../../../examples/', import.meta.url))
    const problems = readCatalog(examples).flatMap((example) =>
      example.problems.map((problem) => `${example.path}: ${problem}`),
    )
    expect(problems).toEqual([])
  })
})
