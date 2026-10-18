import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// The audio unlock in a real browser, under the fake host and Ruken's CSP (M5.3 plan step 9): no AudioContext
// before the player's first gesture, exactly one running after it, and the example's chime decoded and started.
const origin = `http://localhost:${examplesPort}`

interface AudioRecord {
  readonly contexts: AudioContext[]
  started: number
}

declare global {
  interface Window {
    __audio?: AudioRecord
  }
}

test('audio-sound builds one running AudioContext on the first gesture and plays its chime', async ({
  page,
}) => {
  // Every frame records the contexts it builds and the sources it starts.
  await page.addInitScript(() => {
    const record: AudioRecord = { contexts: [], started: 0 }
    window.__audio = record
    const Native = window.AudioContext
    if (Native === undefined) return
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options)
        record.contexts.push(this)
      }
      override createBufferSource(): AudioBufferSourceNode {
        const source = super.createBufferSource()
        const start = source.start.bind(source)
        source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
          record.started++
          start(...args)
        }
        return source
      }
    }
  })
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/audio/sound/`, 'audio-sound')
  const body = frame.locator('body')
  const contexts = () => body.evaluate(() => window.__audio?.contexts.map((context) => context.state) ?? [])

  await expect(frame.getByTestId('title-screen')).toBeVisible()
  expect(await contexts()).toEqual([])

  await frame.getByTestId('play').click()
  await expect.poll(contexts).toEqual(['running'])
  // The sim chimes every 60 ticks, a second of play.
  await expect.poll(() => body.evaluate(() => window.__audio?.started ?? 0)).toBeGreaterThan(0)
  expect(await contexts()).toEqual(['running'])
  expect(errors).toEqual([])
})
