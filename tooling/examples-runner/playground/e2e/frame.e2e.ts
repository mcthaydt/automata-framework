import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { compiled, examples, log, type Message, run, waitFor } from './frame-driver.ts'

// WEB.PLAY.2 (website playground spec §5, §7.2): a playground frame runs the code its parent sends and says what
// happened (frame-driver.ts frames it and compiles the code as the site's compile step will).

test('shapes-rects posts running in its frame', async ({ page }) => {
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects'))
  expect(await waitFor(page, 'running')).toMatchObject({ runId: 1 })
  expect((await log(page)).map((message) => message.type)).toEqual(['booted', 'running'])
})

const RECTS = readFileSync(new URL('shapes/shapes-rects.ts', examples), 'utf8')

/** `source` with `text` as a new line after line `after` (1-based); the new line is `after + 1`. */
function withLine(source: string, after: number, text: string): string {
  const lines = source.split('\n')
  lines.splice(after, 0, text)
  return lines.join('\n')
}

async function failed(page: Page): Promise<Message> {
  const message = await waitFor(page, 'failed')
  expect((await log(page)).map((entry) => entry.type)).not.toContain('determinism')
  return message
}

test('an import the runtime lacks fails the import, and nothing runs', async ({ page }) => {
  await run(
    page,
    'shapes',
    'rects',
    "import { notAnExport } from '@mcthaydt/automata'\nexport default notAnExport\n",
  )
  expect(await failed(page)).toMatchObject({ runId: 1, phase: 'import' })
  expect((await log(page)).map((message) => message.type)).toEqual(['booted', 'failed'])
})

test('a default export that is not defineGame(...) fails the import, saying so', async ({ page }) => {
  await run(page, 'shapes', 'rects', 'export default 42\n')
  expect(await failed(page)).toMatchObject({
    phase: 'import',
    message: "The example's default export must be defineGame(...)",
  })
})

test('a throw in setup fails the boot at its line', async ({ page }) => {
  const source = withLine(RECTS, 40, "      throw new Error('setup broke')")
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects', source))
  expect(await failed(page)).toMatchObject({ phase: 'boot', message: 'setup broke', line: 41 })
})

test('a throw on a later tick fails the run at its line, after running', async ({ page }) => {
  const source = withLine(RECTS, 17, "  if (ctx.tick === 30) throw new Error('broke on tick 30')")
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects', source))
  expect(await failed(page)).toMatchObject({ phase: 'run', message: 'broke on tick 30', line: 18 })
  expect((await log(page)).map((message) => message.type)).toEqual(['booted', 'running', 'failed'])
})

// The compile step puts the guard at the top of each loop body; here it is written by hand.
test('a loop that never ends is stopped by the guard, which names its line', async ({ page }) => {
  const source = withLine(RECTS, 17, '  while (true) { __afLoop(18) }')
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects', source))
  expect(await failed(page)).toMatchObject({ hung: true, line: 18 })
})

const GOLDEN = { ticks: 120, replay: '/playground/goldens/shapes-rects.replay' }

test('the unedited example replays its golden in this browser', async ({ page }) => {
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects'), GOLDEN)
  const report = await waitFor(page, 'determinism')
  expect(report).toMatchObject({
    runId: 1,
    ticks: 120,
    golden: 'pass',
    hash: expect.stringMatching(/^[0-9a-f]{16}$/),
  })
})

test('an edited example reports its own hash for the same ticks, and no golden', async ({ page }) => {
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects'), GOLDEN)
  const golden = await waitFor(page, 'determinism')
  const edited = RECTS.replace('y: y > 196 ? -16 : y + 1', 'y: y > 196 ? -16 : y + 2')
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects', edited), { ticks: 120 })
  await expect
    .poll(async () => (await log(page)).filter((message) => message.type === 'determinism').length)
    .toBe(1)
  const report = await waitFor(page, 'determinism')
  expect(report).toMatchObject({ ticks: 120, golden: 'none' })
  expect(report.hash).not.toBe(golden.hash)
})

// The guard reads the clock and nothing else, so the guarded code replays the same golden.
test('the loop guard leaves the golden hash as it was', async ({ page }) => {
  const guarded = RECTS.replace(/^(\s*for \(const \w+ of ctx\.query\(\w+\)\) \{)$/gm, '$1 __afLoop(0)')
  expect(guarded.match(/__afLoop/g)).toHaveLength(3)
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects', guarded), GOLDEN)
  expect(await waitFor(page, 'determinism')).toMatchObject({ golden: 'pass' })
})

// A check that cannot run is the check's problem, not the example's: the preview keeps running and says so.
test('a golden that cannot be read leaves the preview running and says the check is unavailable', async ({
  page,
}) => {
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects'), {
    ticks: 120,
    replay: '/playground/goldens/no-such-example.replay',
  })
  expect(await waitFor(page, 'determinism-unavailable')).toMatchObject({ runId: 1 })
  expect((await log(page)).map((message) => message.type)).toEqual([
    'booted',
    'running',
    'determinism-unavailable',
  ])
})

// R-6: no-eval must run before any runtime chunk evaluates, or Zod's eval probe trips the policy. Firefox reports the
// probe even though Zod catches it, so the case watches the console of the page and its frame in every engine.
test('shapes-rects runs with no policy violation', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (/Content[- ]Security[- ]Policy|Refused to/i.test(message.text())) violations.push(message.text())
  })
  await run(page, 'shapes', 'rects', compiled('shapes', 'rects'), GOLDEN)
  await waitFor(page, 'determinism')
  expect(violations).toEqual([])
})
