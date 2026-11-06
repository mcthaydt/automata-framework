import { expect, it } from 'vitest'
import { GoldenEvidenceSchema } from '#src/evidence.schema.ts'
import { recordGoldenEvidence } from '#src/golden-evidence.ts'

it("records one engine's golden run in the test's meta, with Node's own version", () => {
  const task = { meta: {} as Record<string, unknown> }
  recordGoldenEvidence(task, { scenario: 'testing/bounce', seed: 42, ticks: 300, hash: '539176c83c864b31' })
  expect(task.meta.goldenEvidence).toEqual({
    scenario: 'testing/bounce',
    seed: 42,
    ticks: 300,
    hash: '539176c83c864b31',
    runtime: { kind: 'node', version: process.version },
  })
  expect(GoldenEvidenceSchema.safeParse(task.meta.goldenEvidence).success).toBe(true)
})

it('keeps whatever else the test put in its meta', () => {
  const task = { meta: { other: 1 } as Record<string, unknown> }
  recordGoldenEvidence(task, { scenario: 's', seed: 1, ticks: 1, hash: '0000000000000000' })
  expect(task.meta.other).toBe(1)
})
