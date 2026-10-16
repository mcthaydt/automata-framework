import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { syncDocs } from '../scripts/sync-docs'

describe('Documentation generation', () => {
  it('regenerates docs and agent context without a removed snippet dependency', () => {
    const output = mkdtempSync(join(tmpdir(), 'automata-docs-'))
    try {
      const docs = syncDocs(output)
      expect(docs.find(doc => doc.slug === 'quick-start')?.content).toContain('git clone https://github.com/mcthaydt/automata-framework.git')
      expect(docs.find(doc => doc.slug === 'capabilities')?.content).toContain('MIT')
      const stored = JSON.parse(readFileSync(join(output, 'src/data/docs.json'), 'utf8'))
      expect(stored).toEqual(docs)
      const full = readFileSync(join(output, 'static/llms-full.txt'), 'utf8')
      expect(full).toContain('configurable player start')
      expect(full).not.toMatch(/STARTER_PLACEHOLDER|developer preview|private dependencies/)
    } finally { rmSync(output, { recursive: true, force: true }) }
  })
})
