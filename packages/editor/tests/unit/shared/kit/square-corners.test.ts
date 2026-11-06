import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

// The editors' look (the 2026-11-06 visual spec): square corners, flat fills, no glow. The website shares the tokens
// and keeps its pills, so the editor draws its corners with its own token, `--edge` (0px), and never with the site's
// `--radius*` or `--pill`. This reads the <style> of every editor component (kit, features, apps) and fails on a
// corner that is not `var(--edge)`, on the site's frosted glass or chartreuse glow, and on a round shape that is not
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
  test('--edge, the editors` corner, is square', () => {
    expect(tokens.tokens.edge).toBe('0px')
  })

  test('find components to read', () => {
    expect(styles().length).toBeGreaterThan(40)
  })

  test('every corner is var(--edge), or 50% on a listed dot', () => {
    const found = styles().flatMap(({ file, code }) =>
      [...code.matchAll(/border(?:-[a-z]+)*-radius:\s*([^;]+);/g)]
        .map((match) => (match[1] as string).trim())
        .filter((value) => !/^(var\(--edge\)\s*)+$/.test(value) && !(value === '50%' && DOTS.includes(file)))
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
