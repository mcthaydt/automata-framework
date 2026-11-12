import { readFileSync } from 'node:fs'
import { examplesPort } from '@automataframework/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automataframework/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// Interface sounds (shared polish, item 4): every control sounds by default with no wiring, a control marked
// `data-sfx="back"` sounds differently, and one marked `data-sfx="none"` stays silent. The example maps the names to
// three files and nothing else, so the sounds are the framework's own: this journey proves they are actually *played*,
// by watching the page's Web Audio. Each source node that starts is noted with its buffer's length and whether its
// context was running, and the three files differ in length, so a sound is told by how long it is. What a person hears is
// still theirs to judge (the speakers are not here); a source that starts on a running context is as far as a page can show.
const origin = `http://localhost:${examplesPort}`

/** A WAV's length in seconds, read from its header (16-bit mono PCM, as the sounds are made). */
const seconds = (name: string): number => {
  const bytes = readFileSync(new URL(`../../resources/sounds/${name}.wav`, import.meta.url))
  return bytes.readUInt32LE(40) / bytes.readUInt32LE(28)
}
const PRESS = seconds('ui-press')
const BACK = seconds('ui-back')

interface Started {
  readonly seconds: number
  readonly running: boolean
}

test('Play presses, Cancel goes back, Mute stays silent: each plays through a running context', async ({
  page,
}) => {
  // Every frame of the page notes the sources it starts, before any of the game's code runs.
  await page.addInitScript(() => {
    const started: Started[] = []
    ;(window as unknown as { __started: Started[] }).__started = started
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      started.push({ seconds: this.buffer?.duration ?? 0, running: this.context.state === 'running' })
      return start.apply(this, args)
    }
  })
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/audio/ui-sounds/`, 'audio-ui-sounds')
  const started = () => frame.evaluate(() => (window as unknown as { __started: Started[] }).__started)
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005
  const count = async (length: number) => (await started()).filter((s) => near(s.seconds, length)).length

  // Play: the press sound starts, on a running context.
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await expect.poll(() => count(PRESS)).toBe(1)
  expect((await started()).every((s) => s.running)).toBe(true)

  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()

  // Mute is marked `none`: its consequence is its own sound, so it adds none. Quit is a plain press, which adds one;
  // Cancel is marked `back`, which is a different, longer sound.
  const presses = await count(PRESS)
  const backs = await count(BACK)
  await frame.getByTestId('pause-mute').click()
  await frame.getByTestId('quit').click()
  await frame.getByTestId('quit-cancel').click()
  await expect.poll(() => count(BACK)).toBe(backs + 1)
  expect(await count(PRESS)).toBe(presses + 1)
  expect(errors).toEqual([])
})
