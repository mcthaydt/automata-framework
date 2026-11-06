import { describe, expect, it } from 'vitest'
import {
  autosaveProblem,
  recoveryUnreadable,
  reloadedMessage,
  savedCopyMessage,
  saveFailure,
} from '#src/shared/kit/dialogs/document-messages.ts'

// The toasts of the document session's flows (kit spec §5 flows 3 and 4; moved from editor-2d's `open-flow-model.ts`
// in ED3D.5c, so both editors say the same thing).

describe('document messages', () => {
  it('a failed save names the file and the store’s reason', () => {
    expect(
      saveFailure('a/b.af2d.json', { status: 'failed', reason: 'quota', message: 'The disk is full.' }),
    ).toBe('Could not save b.af2d.json: The disk is full.')
  })
  it('a copy names the copy', () => {
    expect(savedCopyMessage('a/b copy.af2d.json')).toBe('Saved a copy as b copy.af2d.json.')
  })
  it('an autosave that stopped asks for a save; one that failed once says so', () => {
    expect(
      autosaveProblem({ source: 'autosave', reason: 'quota', message: 'The disk is full.', paused: true }),
    ).toBe('Autosave has stopped: The disk is full. Save to keep your edits.')
    expect(autosaveProblem({ source: 'autosave', reason: 'io', message: 'It broke.', paused: false })).toBe(
      'Autosave failed: It broke. It tries again with the next edit.',
    )
  })
  it('an unreadable autosave and a reload name what happened', () => {
    expect(recoveryUnreadable('Gone.')).toBe(
      'The autosave could not be read (Gone.). The file is open as it was last saved.',
    )
    expect(reloadedMessage('x/a.note')).toBe('Reloaded a.note from the file.')
  })
})
