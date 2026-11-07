import { gateRecordsSchema } from '@automata/editor/gate-records'
import { describe, expect, it } from 'vitest'
import { gateFileOf, gateFileSchema } from '#src/shared/gates-file.ts'

const pending = { id: 'Q-FEEL', stage: 'feel', decision: 'pending', files: ['a.wav'] } as const
const approved = {
  id: 'A-1',
  stage: 'pass',
  decision: 'approved',
  files: [],
  summary: 'listen',
  note: 'good',
  requestedAt: '2026-11-07T10:00:00.000Z',
  decidedAt: '2026-11-07T11:00:00.000Z',
  by: 'owner',
} as const

describe('the gates file', () => {
  it('is the file the editor reads, sorted by id', () => {
    const file = gateFileOf({ 'Q-FEEL': pending, 'A-1': approved })
    expect(gateRecordsSchema.safeParse(file).success).toBe(true)
    expect(file.gates.map((gate) => gate.id)).toEqual(['A-1', 'Q-FEEL'])
  })

  it('writes a pending gate as open and reads it back as pending', () => {
    const file = gateFileOf({ 'Q-FEEL': pending })
    expect(file.gates[0]?.decision).toBe('open')
    expect(gateFileSchema.parse(JSON.parse(JSON.stringify(file)))).toEqual({ 'Q-FEEL': pending })
  })

  it('keeps the stage, files, notes and who decided through a write and a read', () => {
    const back = gateFileSchema.parse(JSON.parse(JSON.stringify(gateFileOf({ 'A-1': approved }))))
    expect(back).toEqual({ 'A-1': approved })
  })

  it('reads a file the first pipelines wrote, keyed by gate id', () => {
    expect(gateFileSchema.parse({ 'Q-FEEL': pending })).toEqual({ 'Q-FEEL': pending })
    expect(gateFileSchema.parse({})).toEqual({})
  })

  it('refuses a record with a key it does not know', () => {
    expect(gateFileSchema.safeParse({ gates: [{ ...pending, decision: 'open', mood: 'x' }] }).success).toBe(
      false,
    )
  })
})
