import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { BaseBootFailed } from './boot.ts'
import { CONNECT_FAILED, DEVICE_FAILED, RendererFailed, SimFailed } from './boot-failure.ts'
import { bootPage } from './boot-page.ts'

// main.ts hands startGame to bootPage; this is what the player sees for each way it can end.
async function pageAfter(start: Effect.Effect<void, unknown>) {
  const root = { textContent: '' }
  const html = { dataset: {} as Record<string, string> }
  const log = vi.fn()
  await bootPage({ root, html, start, log })
  return { text: root.textContent, state: html.dataset.state, log }
}

describe('bootPage', () => {
  it('marks the page ready when the game starts', async () => {
    const page = await pageAfter(Effect.void)
    expect(page.state).toBe('ready')
    expect(page.text).toBe('')
    expect(page.log).not.toHaveBeenCalled()
  })

  it('shows the connection message only when the Ruken handshake fails', async () => {
    const page = await pageAfter(Effect.fail(new BaseBootFailed({ step: 'init', cause: 'no host' })))
    expect(page).toMatchObject({ text: CONNECT_FAILED, state: 'failed' })
  })

  it('shows the device message when the renderer or the sim cannot start, or on a defect', async () => {
    for (const start of [
      Effect.fail(new RendererFailed({ cause: 'no canvas context' })),
      Effect.fail(new SimFailed({ cause: 'wasm blocked' })),
      Effect.die(new Error('bug')),
    ]) {
      expect(await pageAfter(start)).toMatchObject({ text: DEVICE_FAILED, state: 'failed' })
    }
  })

  it('logs the underlying error, not only the failure tag', async () => {
    const underlying = new Error('CompileError: wasm blocked')
    const page = await pageAfter(Effect.fail(new SimFailed({ cause: underlying })))
    expect(page.log).toHaveBeenCalledWith(expect.any(String), underlying)
  })
})
