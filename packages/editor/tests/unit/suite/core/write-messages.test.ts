import { describe, expect, it } from 'vitest'
import { findingMessage, refusalMessage } from '#src/features/suite/core/write-messages.ts'

// What the suite's toasts say when a write, an undo or a redo does not land, and where a check finding is.
describe('refusalMessage', () => {
  it('says nothing for a write that landed or a cancelled one', () => {
    expect(refusalMessage({ written: true })).toBeUndefined()
    expect(refusalMessage({ cancelled: true })).toBeUndefined()
    expect(refusalMessage(undefined)).toBeUndefined()
  })

  it('says why a write was refused, in the words its refusal carries', () => {
    expect(refusalMessage({ refused: 'moved', path: 'content/tuning.toml' })).toBe(
      'content/tuning.toml changed since this step was written, so it was not undone.',
    )
    expect(refusalMessage({ refused: 'policy', why: 'This file is read only.' })).toBe(
      'This file is read only.',
    )
    expect(
      refusalMessage({
        refused: 'checks',
        results: [],
        findings: [
          { severity: 'error', path: 'a', message: 'Too fast' },
          { severity: 'error', path: 'b', message: 'Too high' },
        ],
      }),
    ).toBe('Too fast; Too high')
    expect(
      refusalMessage({ refused: 'storage', reason: 'conflict', message: 'The file changed on disk.' }),
    ).toBe('The file changed on disk.')
  })
})

describe('findingMessage', () => {
  it('names the file, then the key or the line, then the problem', () => {
    expect(
      findingMessage({ severity: 'error', path: 'a.toml', keyPath: 'MAX_RUN', message: 'Too fast' }),
    ).toBe('a.toml, MAX_RUN: Too fast')
    expect(findingMessage({ severity: 'error', path: 'a.toml', line: 3, message: 'Bad' })).toBe(
      'a.toml, line 3: Bad',
    )
    expect(findingMessage({ severity: 'error', path: 'a.toml', message: 'Bad' })).toBe('a.toml: Bad')
  })
})
