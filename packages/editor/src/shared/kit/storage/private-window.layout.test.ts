import { describe, expect, test } from 'vitest'
import { openWorkspace } from './workspace'

// Runs only in the `webkit (private)` instance: Playwright's default WebKit context, which is ephemeral like a
// private window. There WebKit refuses the origin private file system, which is the case EK-f is about: the editor
// must fall back to memory, say so, and keep working. The persistent instances run storage.layout.test.ts instead.

describe('the workspace in a private window (EK-f)', () => {
  test('falls back to memory with the reason, and edits still read back for this session', async () => {
    const workspace = await openWorkspace()
    expect(workspace.persistent).toBe(false)
    expect(workspace.reason).toMatch(/\S/)
    expect(workspace.store.kind).toBe('memory')
    expect(workspace.journal.kind).toBe('memory')
    expect(workspace.exports.kind).toBe('download')
    expect((await workspace.store.write('stage.toml', 'n = 1')).ok).toBe(true)
    expect(new TextDecoder().decode(await workspace.store.read('stage.toml'))).toBe('n = 1')
  })

  // Known issue, not a product assertion (EDK.6a): Chromium 153 crashes the whole browser (SIGTRAP) when it reads
  // a directory handle back from IndexedDB in an ephemeral context, so the folder vault cannot be run in one; the
  // crash would end every other test in the run. Chromium 141 did not crash. It runs in the persistent profiles.
  test.skip('Chromium 153, ephemeral: reading a folder handle back from IndexedDB crashes the browser', () => {})
})
