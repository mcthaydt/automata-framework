import { readFileSync as readBytes, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'
import { readCatalog } from '../../src/catalog.ts'
import { playgroundCatalog } from '../../src/playground/playground-catalog.ts'
import { checkRuntimeSize, RUNTIME_GZIP_BUDGET } from '../../src/playground/runtime-size.ts'
import { compiled, examples, log, run, waitFor } from './frame-driver.ts'

// A-17 (website playground spec §16): every example in the catalog runs in the playground, unedited, with no console
// error and no policy violation, in Chromium, WebKit and Firefox. A failure is fixed in the framework, never by
// loosening the frame's policy. A pending example's frame page runs nothing, so it is skipped with its reason.
const catalog = playgroundCatalog(readCatalog(fileURLToPath(examples)), (entry) =>
  readFileSync(entry.file, 'utf8'),
)

for (const example of catalog) {
  test(`${example.id} runs in the playground with no error or policy violation`, async ({ page }) => {
    test.skip(example.pending !== undefined, `pending: ${example.pending}`)
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' || /Content[- ]Security[- ]Policy|Refused to/i.test(message.text()))
        errors.push(`${message.type()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    // Every run asks for the determinism check (the golden when there is one, else its own hash for 60 ticks), so
    // the case waits past `running` to the frame's last message: a failure or a console line after `running` counts.
    const determinism = example.golden ?? { ticks: 60 }
    await run(page, example.module, example.name, compiled(example.module, example.name), determinism)
    await waitFor(page, 'determinism')
    const types = (await log(page)).map((message) => message.type)
    expect(types).toEqual(['booted', 'running', 'determinism'])
    if (example.golden !== undefined)
      expect((await log(page)).find((message) => message.type === 'determinism')).toMatchObject({
        golden: 'pass',
      })
    expect(errors).toEqual([])
  })
}

// §10.1: the runtime the frame server built (`e2e:playground-frame`) within its gzip budget, one engine is enough.
test("the playground runtime's JavaScript is within its gzip budget", async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'the bytes are the same in every engine')
  const folder = fileURLToPath(new URL('../dist/runtime/assets/', import.meta.url))
  const files = readdirSync(folder).map((name) => ({
    path: `runtime/assets/${name}`,
    bytes: readBytes(folder + name),
  }))
  const size = checkRuntimeSize(files, RUNTIME_GZIP_BUDGET)
  expect(size.gzipBytes).toBeGreaterThan(gzipSync('x').length)
  expect(size, `${size.gzipBytes} B gzip`).toMatchObject({ ok: true })
})
