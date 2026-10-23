// @vitest-environment node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stackSections, stackTitle } from '../src/lib/stack'
import source from '../src/data/stack.source.json'

// PRODUCT.4w. The framework generates `docs/stack.md` (PRODUCT spec §8: one card per library, with its role, why it
// was chosen, what AF adds, its licence and its tier, versions read from the pins). The site renders that page on
// /inside and never rewrites it: the copy in src/data is held to the framework's file at the recorded commit.

const root = resolve(import.meta.dirname, '..')
const copy = readFileSync(resolve(root, 'src/data/stack.md'), 'utf8')

describe('the site’s copy of the framework’s stack page', () => {
  it('is the file the recorded sha256 says it is', () => {
    expect(createHash('sha256').update(copy).digest('hex')).toBe(source.sha256)
  })

  it('is exactly docs/stack.md at the recorded framework commit', () => {
    let framework: string
    try {
      framework = execFileSync('git', ['-C', resolve(root, '../automata-framework'), 'show', `${source.commit}:${source.path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      throw new Error(`the framework checkout at ../automata-framework has no commit ${source.commit}; fetch it (git fetch origin)`)
    }
    expect(copy).toBe(framework)
  })
})

describe('stackSections', () => {
  it('reads the title and splits the page into its introduction and one section per library and the Planck note', () => {
    expect(stackTitle(copy)).toBe("What's inside")
    const { intro, sections } = stackSections(copy)
    expect(intro.some(block => block.type === 'table')).toBe(true)
    expect(sections.map(section => section.title)).toEqual(['PixiJS 8', 'Koota', 'Effect', 'Zod', 'Svelte 5', 'Paraglide', 'smol-toml', 'Ruken SDK', 'Vite, Vitest, Playwright', 'Rapier (deterministic-compat)', 'Colyseus', "Why FloorFifty's Planck becomes Rapier"])
  })

  it('drops the generated-file comment and the title, which the page shows itself', () => {
    const { intro, sections } = stackSections(copy)
    const text = JSON.stringify([intro, sections])
    expect(text).not.toContain('<!--')
    expect(text).not.toContain('Do not edit by hand')
  })

  it('points the one relative link at the framework’s source instead of a page the site does not have', () => {
    const text = JSON.stringify(stackSections(copy))
    expect(text).not.toContain('](versions.md)')
    expect(text).toContain('](https://github.com/mcthaydt/automata-framework/blob/main/docs/versions.md)')
  })

  it('leaves in-page anchors and absolute links alone', () => {
    const { intro } = stackSections('# T\n\n[Jump](#koota) and [PixiJS](https://pixijs.com/8.x) and [root](/docs)\n')
    expect(JSON.stringify(intro)).toContain('(#koota)')
    expect(JSON.stringify(intro)).toContain('(https://pixijs.com/8.x)')
    expect(JSON.stringify(intro)).toContain('(/docs)')
  })

  it('fails loudly on markdown the page cannot render, rather than showing it raw', () => {
    expect(() => stackSections('# T\n\n## A\n\n```ts\ncode\n```\n')).toThrow(/cannot render/)
    expect(() => stackSections('# T\n\n> [!NOTE] x\n')).toThrow(/cannot render/)
    expect(() => stackSections('# T\n\n1. first\n2. second\n')).toThrow(/cannot render/)
    expect(() => stackSections('# T\n\n## A\n\n### B\n')).toThrow(/cannot render/)
  })
})
