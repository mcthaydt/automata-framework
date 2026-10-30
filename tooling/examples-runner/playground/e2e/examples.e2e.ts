import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { readCatalog } from '../../src/catalog.ts'
import { playgroundCatalog } from '../../src/playground/playground-catalog.ts'
import { compiled, examples, run, waitFor } from './frame-driver.ts'

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
    await run(page, example.module, example.name, compiled(example.module, example.name))
    const outcome = await Promise.race([waitFor(page, 'running'), waitFor(page, 'failed')])
    expect(outcome, JSON.stringify(outcome)).toMatchObject({ type: 'running' })
    expect(errors).toEqual([])
  })
}
