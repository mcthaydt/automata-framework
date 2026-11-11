// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_URL } from '#src/shared/editor-link.ts'
import { REDIRECTS } from '#src/shared/redirects.ts'
import { redirectsFile, writeRedirects } from '../../../scripts/write-redirects.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

// The site has no redirect pages of its own (its checks refuse a page that only redirects), so the one old address it
// keeps, /editor, is a rule the host answers: Cloudflare Pages reads it from `_redirects`, written beside `_headers`.
describe('redirectsFile', () => {
  it('writes one line per rule: from, to, status', () => {
    expect(redirectsFile([{ from: '/a', to: '/b/', status: 301 }])).toBe('/a /b/ 301\n')
  })

  it('refuses a rule the host would read differently: a status that is not a redirect, or an address with a space', () => {
    expect(() => redirectsFile([{ from: '/a', to: '/b', status: 200 as 301 }])).toThrow(/status/)
    expect(() => redirectsFile([{ from: '/a b', to: '/c', status: 301 }])).toThrow(/space/)
  })
})

describe('the site’s redirects', () => {
  it('send /editor to the editor itself, once', () => {
    expect(REDIRECTS).toEqual([{ from: '/editor', to: '/editor/app/', status: 301 }])
    expect(EDITOR_URL).toBe('/editor/app/')
  })

  it('are written into the build as _redirects, exactly that rule', () => {
    const root = mkdtempSync(join(tmpdir(), 'redirects-'))
    roots.push(root)
    const text = writeRedirects(root)
    expect(text).toBe('/editor /editor/app/ 301\n')
    expect(readFileSync(join(root, '_redirects'), 'utf8')).toBe(text)
  })

  it('run in the build after the headers', () => {
    const scripts = JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'))
      .scripts as {
      build: string
    }
    const steps = scripts.build.split('&&').map((step) => step.trim())
    const headers = steps.indexOf('node scripts/write-headers.ts build')
    expect(headers).toBeGreaterThan(-1)
    expect(steps[headers + 1]).toBe('node scripts/write-redirects.ts build')
  })
})
