import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUS_DOC, SAVES_DOC, SERVICE_MODEL_DOC } from '../src/data/deep-docs'
import { getDocBySlug } from '../src/data/docs-loader'

// Ritmo gaps 6 and 7 and the Plus docs section (M10.4): each page says only what its framework source says.
describe('deep docs', () => {
  it('are published as docs, in the sidebar categories they name', () => {
    for (const doc of [SERVICE_MODEL_DOC, SAVES_DOC, PLUS_DOC]) {
      expect(getDocBySlug(doc.slug)?.category, doc.slug).toBe(doc.category)
      expect(getDocBySlug(doc.slug)?.toc.length, doc.slug).toBeGreaterThan(2)
    }
  })

  it('services and failure names what ADR 0003 decides and claims no catch-all', () => {
    const text = SERVICE_MODEL_DOC.content
    expect(text).toMatch(/never imports Effect/)
    expect(text).toMatch(/TestClock/)
    expect(text).toMatch(/does not fall back to device storage/)
    expect(text).toMatch(/not a claim that every failure is caught/)
  })

  it('saves and migrations states the M5 rules', () => {
    const text = SAVES_DOC.content
    expect(text).toMatch(/migrations\[n\]/)
    expect(text).toMatch(/newer build/)
    expect(text).toMatch(/unreadable/)
    expect(text).toMatch(/does not write to the device instead/)
  })

  it('every SaveDef field it names exists in the API reference', () => {
    const api = readFileSync(resolve(import.meta.dirname, '../../tooling/api-index/dist/llms-api.txt'), 'utf8')
    for (const field of ['SaveDef', 'migrations', 'empty']) expect(api, field).toContain(field)
  })

  it('Plus says it is free and not yet installable, and names no unpublished package', () => {
    const text = PLUS_DOC.content
    expect(text).toMatch(/Plus is free/)
    expect(text).toMatch(/not yet open to install from/)
    expect(text).not.toMatch(/npm install|npx /)
  })
})
