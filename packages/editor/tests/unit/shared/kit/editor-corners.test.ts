import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

// The editors' look (the 2026-11-06 visual spec): slightly rounded corners on one scale, flat fills, no glow. The
// website shares the tokens and keeps its own radii, so the editor draws its corners with its own scale (`--edge-sm`
// 4px, `--edge-md` 6px, `--edge-lg` 8px) and never with the site's `--radius*` or `--pill`. This reads the <style> of every editor component (kit, features, apps) and fails on a
// corner off that scale, on the site's frosted glass or chartreuse glow, and on a round shape that is not
// one of the dots below.
const SRC = fileURLToPath(new URL('../../../../src/', import.meta.url))
const tokens = JSON.parse(readFileSync(join(SRC, 'shared/kit/tokens/tokens.json'), 'utf8')) as {
  tokens: Record<string, string>
}

/** The only round shapes: status and colour dots, small enough that a square reads as a glitch. */
const DOTS = ['shared/kit/home/SourcesPanel.svelte', 'features/characters/DefinitionPreview.svelte']

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return svelteFiles(path)
    return entry.name.endsWith('.svelte') ? [path] : []
  })
}

function styles(): Array<{ file: string; code: string }> {
  return svelteFiles(SRC).map((path) => {
    const style = readFileSync(path, 'utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    return { file: relative(SRC, path), code: style.replace(/\/\*[\s\S]*?\*\//g, '') }
  })
}

describe('the editors` corners and fills', () => {
  test('the editors` corners are slightly rounded: 4, 6 and 8 px, never a pill', () => {
    expect([tokens.tokens['edge-sm'], tokens.tokens['edge-md'], tokens.tokens['edge-lg']]).toEqual([
      '4px',
      '6px',
      '8px',
    ])
  })

  test('find components to read', () => {
    expect(styles().length).toBeGreaterThan(40)
  })

  test('every corner is on the --edge scale (0 for a squared side), or 50% on a listed dot', () => {
    const found = styles().flatMap(({ file, code }) =>
      [...code.matchAll(/border(?:-[a-z]+)*-radius:\s*([^;]+);/g)]
        .map((match) => (match[1] as string).trim())
        .filter(
          (value) =>
            !/^((var\(--edge-(sm|md|lg)\)|0)\s*)+$/.test(value) && !(value === '50%' && DOTS.includes(file)),
        )
        .map((value) => `${file}: ${value}`),
    )
    expect(found).toEqual([])
  })

  test('no frosted glass, chartreuse or glow: those are the website`s', () => {
    const found = styles().flatMap(({ file, code }) =>
      [...code.matchAll(/var\(--(glass|glow|lime|lime-deep|flutes[a-z-]*|curtain)\)/g)].map(
        (match) => `${file}: ${match[0]}`,
      ),
    )
    expect(found).toEqual([])
  })
})
