import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

// The kit draws only with the tokens (tokens.json), so the look changes in one place. This reads the <style> of every
// kit component and fails on a literal colour or on a name from before the redesign (the aliases kept for editor-3d).
const KIT = fileURLToPath(new URL('../../../../src/shared/kit/', import.meta.url))

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'tokens' ? [] : svelteFiles(path)
    return entry.name.endsWith('.svelte') ? [path] : []
  })
}

const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi
const OLD_NAME = /--color-(bg|border|text|accent|state)-[a-z-]+/g

function findings(pattern: RegExp): string[] {
  return svelteFiles(KIT).flatMap((file) => {
    const style = readFileSync(file, 'utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    const code = style.replace(/\/\*[\s\S]*?\*\//g, '')
    return [...code.matchAll(pattern)].map((match) => `${relative(KIT, file)}: ${match[0]}`)
  })
}

describe('the kit`s styles', () => {
  test('find components to read', () => {
    expect(svelteFiles(KIT).length).toBeGreaterThan(15)
  })

  test('use no literal colour', () => {
    expect(findings(LITERAL)).toEqual([])
  })

  test('use the token names, not the old editor aliases', () => {
    expect(findings(OLD_NAME)).toEqual([])
  })
})
