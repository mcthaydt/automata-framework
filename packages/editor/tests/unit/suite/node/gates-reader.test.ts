import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import type { GateRow } from '#src/features/suite/core/index.ts'
import { createGatesReader } from '#src/features/suite/node/gates-reader.ts'
import { describeGates, GATES_SCENARIO } from '#src/testing/ports/gates-contract.ts'

const made: string[] = []
afterAll(async () => {
  for (const dir of made) await rm(dir, { recursive: true, force: true })
})

async function game(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'af-gates-'))
  made.push(root)
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  return root
}

const record = (gates: readonly object[]) => JSON.stringify({ gates })

describeGates('records', async (records) => {
  const rows: GateRow[] = Object.entries(GATES_SCENARIO).map(([id, state]) => ({
    id,
    name: state.name,
    records: 'docs/gates/**/gates.json',
  }))
  if (records === 'unreadable')
    return createGatesReader({ root: await game({ 'docs/gates/p/gates.json': '{ not json' }), gates: rows })
  const files = Object.fromEntries(
    Object.entries(records).map(([id, { name: _, ...decision }]) => [
      `docs/gates/${id.toLowerCase()}/gates.json`,
      record([{ id, ...decision }]),
    ]),
  )
  return createGatesReader({ root: await game(files), gates: rows })
})

describe('the gates reader', () => {
  test('{scene} in records matches any scene, and the latest decision wins', async () => {
    const root = await game({
      'docs/art/bay/puzzle/gates.json': record([
        { id: 'P-G1', decision: 'rejected', decidedAt: '2026-10-01T00:00:00Z' },
      ]),
      'docs/art/dock/puzzle/gates.json': record([
        { id: 'P-G1', decision: 'approved', decidedAt: '2026-10-20T00:00:00Z' },
      ]),
    })
    const gates = createGatesReader({
      root,
      gates: [{ id: 'P-G1', name: 'Puzzle doc', records: 'docs/art/{scene}/puzzle/gates.json' }],
    })
    expect(await gates.states(['P-G1'])).toEqual([
      { id: 'P-G1', name: 'Puzzle doc', decision: 'approved', decidedAt: '2026-10-20T00:00:00Z' },
    ])
  })

  test('a declared gate whose records folder does not exist yet is unknown, under its name', async () => {
    const gates = createGatesReader({
      root: await game({}),
      gates: [{ id: 'Q-FEEL', name: 'Feel', records: 'docs/feel/gates.json' }],
    })
    expect(await gates.states(['Q-FEEL'])).toEqual([{ id: 'Q-FEEL', name: 'Feel', decision: 'unknown' }])
  })

  test('a record with a decision the suite does not know rejects', async () => {
    const gates = createGatesReader({
      root: await game({ 'docs/feel/gates.json': record([{ id: 'Q-FEEL', decision: 'maybe' }]) }),
      gates: [{ id: 'Q-FEEL', name: 'Feel', records: 'docs/feel/gates.json' }],
    })
    await expect(gates.states(['Q-FEEL'])).rejects.toThrow(/docs\/feel\/gates.json/)
  })

  test('an older keyed file rejects with the words the review desk shows, not a schema dump', async () => {
    const keyed = {
      'Q-FEEL': { id: 'Q-FEEL', stage: 'feel', decision: 'pending', files: ['feel/report.md'] },
    }
    const gates = createGatesReader({
      root: await game({ 'docs/feel/gates.json': JSON.stringify(keyed) }),
      gates: [{ id: 'Q-FEEL', name: 'Feel', records: 'docs/feel/gates.json' }],
    })
    await expect(gates.states(['Q-FEEL'])).rejects.toThrow(
      'docs/feel/gates.json was saved by an older version of the pipelines. Run the pipeline again to update it.',
    )
  })
})
