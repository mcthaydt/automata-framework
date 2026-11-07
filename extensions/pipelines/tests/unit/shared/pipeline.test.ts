import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { EXIT } from '#src/shared/exit.ts'
import { definePipeline, type StageDef } from '#src/shared/pipeline.ts'

const stage = (id: string, extra: Partial<StageDef> = {}): StageDef => ({
  id,
  run: () => Effect.succeed({}),
  ...extra,
})

describe('the exit codes', () => {
  it('are fixed: done, failed, not implemented, at a gate, refused', () => {
    expect(EXIT).toEqual({ done: 0, failed: 1, notImplemented: 2, atGate: 3, refused: 4 })
  })
})

describe('definePipeline', () => {
  it('returns the definition it is given', () => {
    const def = { name: 'toy', spec: z.object({}), stages: [stage('one'), stage('two', { gate: 'T1' })] }
    expect(definePipeline(def)).toBe(def)
  })

  it('refuses a duplicate stage id', () => {
    expect(() =>
      definePipeline({ name: 'toy', spec: z.object({}), stages: [stage('one'), stage('one')] }),
    ).toThrow("toy: stage 'one' is defined twice")
  })

  it('refuses a gate used by two stages', () => {
    const stages = [stage('one', { gate: 'G1' }), stage('two', { gate: 'G1' })]
    expect(() => definePipeline({ name: 'toy', spec: z.object({}), stages })).toThrow(
      "toy: gate 'G1' is on stages one and two",
    )
  })

  it.each([0, -1, 1.5])('refuses a cost of %s units', (units) => {
    const stages = [stage('paid', { cost: { budget: 'images', units } })]
    expect(() => definePipeline({ name: 'toy', spec: z.object({}), stages })).toThrow(
      `toy: stage 'paid' costs ${units} images; a cost is a positive whole number of units`,
    )
  })

  it('refuses a pipeline with no stages or a name that is not kebab-case', () => {
    expect(() => definePipeline({ name: 'toy', spec: z.object({}), stages: [] })).toThrow('toy: no stages')
    expect(() => definePipeline({ name: 'Toy Pipe', spec: z.object({}), stages: [stage('one')] })).toThrow(
      "'Toy Pipe' is not a pipeline name (lowercase words joined by '-')",
    )
  })
})
