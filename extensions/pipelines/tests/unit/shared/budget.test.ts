import { describe, expect, it } from 'vitest'
import { budgetRefusal, parseBudgetOption } from '#src/shared/budget.ts'

const toml = { budget: { images: { project: 10, run: 4 }, meshyCredits: { project: 900, run: 520 } } }

describe('budgetRefusal', () => {
  it('passes a need within both caps, and an empty need', () => {
    expect(budgetRefusal({ images: 4 }, toml, { images: 6 })).toBeUndefined()
    expect(budgetRefusal({}, { budget: {} }, {})).toBeUndefined()
  })

  it('refuses one unit over the run budget', () => {
    expect(budgetRefusal({ images: 5 }, toml, {})).toBe(
      'over budget: this run needs 5 images, the run budget is 4',
    )
  })

  it('refuses one unit over what is left of the project budget', () => {
    expect(budgetRefusal({ images: 3 }, toml, { images: 8 })).toBe(
      'over budget: this run needs 3 images, the project has 2 of 10 left',
    )
  })

  it('refuses a paid key with no budget (fail closed)', () => {
    expect(budgetRefusal({ visionCalls: 1 }, toml, {})).toBe(
      'no budget for visionCalls: set [budget.visionCalls] in pipeline.toml',
    )
  })

  it('takes a --budget cap below the run budget, never above it', () => {
    expect(budgetRefusal({ images: 3 }, toml, {}, { images: 2 })).toBe(
      'over budget: this run needs 3 images, the run budget is 2',
    )
    expect(budgetRefusal({ images: 5 }, toml, {}, { images: 9 })).toBe(
      'over budget: this run needs 5 images, the run budget is 4',
    )
    expect(budgetRefusal({ visionCalls: 1 }, toml, {}, { visionCalls: 5 })).toMatch(
      /^no budget for visionCalls/,
    )
  })

  it('names the first refused key in key order', () => {
    expect(budgetRefusal({ meshyCredits: 600, images: 5 }, toml, {})).toMatch(/needs 5 images/)
  })
})

describe('parseBudgetOption', () => {
  it('reads key=N pairs', () => {
    expect(parseBudgetOption('images=2, meshyCredits=40')).toEqual({ images: 2, meshyCredits: 40 })
  })

  it.each(['images', 'images=', 'images=-1', 'images=1.5', 'images=x', '=3'])('refuses %j', (text) => {
    expect(() => parseBudgetOption(text)).toThrow(`--budget: '${text}' is not key=N (N a whole number)`)
  })
})
