import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { pipelineTomlSchema } from '#src/shared/pipeline-toml.schema.ts'

// The game's pipeline.toml content: budgets per key, the generated paths and the locked values (the last two are the
// guard's; they are parsed here so the file has one schema).
const FULL = `
generated = ["public/art/*.png", "content/characters.toml"]

[budget.images]
project = 60
run = 16

[budget.meshyCredits]
project = 900
run = 520

[locked]
lensMm = 24
dither = true
`

const issues = (text: string) => {
  const parsed = pipelineTomlSchema.safeParse(parse(text))
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('pipeline.toml', () => {
  it('parses budgets per key, the generated paths and the locked values', () => {
    expect(pipelineTomlSchema.parse(parse(FULL))).toEqual({
      budget: { images: { project: 60, run: 16 }, meshyCredits: { project: 900, run: 520 } },
      generated: ['public/art/*.png', 'content/characters.toml'],
      locked: { lensMm: 24, dither: true },
    })
  })

  it('defaults to no budgets, nothing generated and nothing locked', () => {
    expect(pipelineTomlSchema.parse(parse(''))).toEqual({ budget: {}, generated: [], locked: {} })
  })

  it('refuses an unknown key, at the top and in a budget', () => {
    expect(issues('baselines = "docs"')).toEqual([': Unrecognized key: "baselines"'])
    expect(issues('[budget.images]\nproject = 1\nrun = 1\nper = 2')).toEqual([
      'budget.images: Unrecognized key: "per"',
    ])
  })

  it('refuses a negative or fractional budget, and a missing cap', () => {
    expect(issues('[budget.images]\nproject = -1\nrun = 0')).toEqual([
      'budget.images.project: Too small: expected number to be >=0',
    ])
    expect(issues('[budget.images]\nproject = 2\nrun = 1.5')).toEqual([
      'budget.images.run: Invalid input: expected int, received number',
    ])
    expect(issues('[budget.images]\nproject = 2')).toEqual([
      'budget.images.run: Invalid input: expected number, received undefined',
    ])
  })

  it('refuses a run budget above the project budget', () => {
    expect(issues('[budget.images]\nproject = 2\nrun = 3')).toEqual([
      'budget.images: the run budget (3) is above the project budget (2)',
    ])
  })

  it('refuses a budget key that is not a camelCase word', () => {
    expect(issues('[budget.meshy-credits]\nproject = 2\nrun = 1')).toHaveLength(1)
  })
})
