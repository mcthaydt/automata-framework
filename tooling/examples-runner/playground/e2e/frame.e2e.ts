import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { expect, type Page, test } from '@playwright/test'
import { playgroundFrameOrigin } from '../../host/ports.ts'

// WEB.PLAY.2 (website playground spec §5, §7.2): a playground frame runs the code its parent sends and says what
// happened. The site's compile step does not exist here, so each case strips the types with Node's own stripper
// (which keeps every line where it was) and does what the compile step will: rewrite import.meta.url and name the
// file with a sourceURL. Every wait is on a message from the frame, never a sleep.

interface Message {
  readonly type: string
  readonly runId?: number
  readonly phase?: string
  readonly message?: string
  readonly line?: number
  readonly hung?: boolean
  readonly golden?: string
  readonly hash?: string
  readonly ticks?: number
}

const examples = new URL('../../../../examples/', import.meta.url)

function compiled(module: string, name: string, source?: string): string {
  const file = `${module}/${module}-${name}.ts`
  const text = source ?? readFileSync(new URL(file, examples), 'utf8')
  const moduleUrl = `${playgroundFrameOrigin}/playground/examples/${file}`
  return `${stripTypeScriptTypes(text).replaceAll('import.meta.url', JSON.stringify(moduleUrl))}\n//# sourceURL=examples/${file}\n`
}

async function run(
  page: Page,
  module: string,
  name: string,
  code: string,
  determinism?: { ticks: number; replay?: string },
): Promise<void> {
  await page.goto(`${playgroundFrameOrigin}/`)
  await page.evaluate(
    ([url, text, check]) =>
      (window as unknown as { run(u: string, c: string, d?: unknown): void }).run(
        url,
        text,
        check ?? undefined,
      ),
    [`/playground/examples/${module}/${name}/`, code, determinism ?? null] as const,
  )
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { frameLog: Message[] }).frameLog)

async function waitFor(page: Page, type: string): Promise<Message> {
  await expect
    .poll(async () => (await log(page)).map((message) => message.type), { timeout: 20_000 })
    .toContain(type)
  return (await log(page)).find((message) => message.type === type) as Message
}

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
