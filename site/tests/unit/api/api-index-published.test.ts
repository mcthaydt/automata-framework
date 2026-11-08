import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GET as llmsIndex } from '../../../src/routes/llms.txt/+server'
import { GET as llmsApi } from '../../../src/routes/llms-api.txt/+server'
import { GET as llmsFull } from '../../../src/routes/llms-full.txt/+server'

// The framework's generated llms-full.txt and llms-api.txt are served unchanged (DX.10a, DX spec §2.3), read from
// tooling/api-index/dist when the site is built: no copy to drift from what `pnpm api-index` wrote.
const dist = resolve(import.meta.dirname, '../../../../tooling/api-index/dist')
const read = (name: string): string => readFileSync(resolve(dist, name), 'utf8')
const version = (JSON.parse(read('api.json')) as { version: string }).version

describe('the framework API index, as published', () => {
  it('serves llms-full.txt and llms-api.txt exactly as the index wrote them', async () => {
    expect(await llmsFull().text()).toBe(read('llms-full.txt'))
    expect(await llmsApi().text()).toBe(read('llms-api.txt'))
  })

  it('lists the three plain-text files in llms.txt with what each one holds', async () => {
    const index = await llmsIndex().text()
    expect(index).toContain(
      `- [Full documentation](/llms-full.txt): Every guide and Reference page in one file, for version ${version}.`,
    )
    expect(index).toContain(
      `- [API reference](/llms-api.txt): Every export of the ${version} packages with its signature and doc comment, generated from the package declarations.`,
    )
    expect(index).toContain('- [Site guides](/llms-guides.txt): Every guide on this site, in full.')
  })
})
