import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { RESTORATIONS } from '../src/data/restorations'
import Community from '../src/routes/community/+page.svelte'

// DX.10b to DX.10e: a cut claim is on the site if and only if its proof is recorded. The site's published surfaces are scanned,
// not just the pages this PR added, so a claim cannot come back through a doc, a data file or llms.txt.
const SURFACES = ['src/routes', 'src/lib', 'src/data/docs.json', 'src/data/deep-docs.ts', 'src/data/cheatsheet.ts', 'src/data/ai-guidance.ts', 'src/data/agent-setup.ts', 'src/data/creative-starts.ts', 'static/llms.txt', 'static/llms-guides.txt']

function files(path: string): string[] {
  return statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => files(join(path, name))) : [path]
}
const surface = SURFACES.flatMap(files).map((file) => ({ file, text: readFileSync(file, 'utf8') }))

describe('restorations', () => {
  it('names four rows, each with the proof it waits for', () => {
    expect(RESTORATIONS.map((r) => r.row)).toEqual(['DX.10b', 'DX.10c', 'DX.10d', 'DX.10e'])
    for (const r of RESTORATIONS) expect(r.needs.length, r.row).toBeGreaterThan(20)
  })

  for (const r of RESTORATIONS) {
    if (r.proof === null) {
      it(`${r.row}: no proof recorded, so none of its wording is on the site`, () => {
        expect(r.copy).toBeNull()
        for (const { file, text } of surface) expect(text, `${file} carries ${r.row}'s cut claim`).not.toMatch(r.forbidden)
      })
    } else {
      it(`${r.row}: proof recorded as a link, and its copy is published`, () => {
        expect(r.proof).toMatch(/^https:\/\//)
        expect(r.copy).toBeTruthy()
        expect(surface.some(({ text }) => text.includes(r.copy as string))).toBe(true)
      })
    }
  }

  it('the community page shows the chat invite only with its proof', () => {
    const text = render(Community).container.textContent ?? ''
    expect(text).toContain('There is no chat server yet')
    expect(render(Community).container.querySelector('a[href*="discord"]')).toBeNull()
  })
})
