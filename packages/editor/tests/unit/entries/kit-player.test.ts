// The player entry (`@mcthaydt/automata-editor/kit/player`): compiles a game's own files in a page. It reaches no Node,
// no Effect, no DOM and no Svelte, so the Automata app and the web editors can both run it.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import * as player from '#src/entries/kit-player.ts'

const SRC = resolve(import.meta.dirname, '../../../src')

function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen
  seen.add(entry)
  for (const [, specifier] of readFileSync(entry, 'utf8').matchAll(/from\s+'(\.[^']*)'/g)) {
    const base = resolve(dirname(entry), specifier as string)
    reachable(/\.(ts|svelte)$/.test(base) ? base : `${base}.ts`, seen)
  }
  return seen
}

describe('the kit player entry', () => {
  test('gives a host the compile, the runtime list and the scanner', () => {
    expect(Object.keys(player).sort()).toEqual([
      'FRAMEWORK_PREFIX',
      'RUNTIME_SPECIFIERS',
      'compileGame',
      'scanSpecifiers',
    ])
  })

  test('imports no Svelte component, no Node built-in, no Effect, and only the content compile and sucrase from outside', () => {
    for (const file of reachable(resolve(SRC, 'entries/kit-player.ts'))) {
      expect(file.endsWith('.svelte'), file).toBe(false)
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^import[^']*?from\s+'([^']+)'/gm))
        expect(specifier, `${file} imports ${specifier}`).toMatch(
          /^\.|^sucrase$|^@mcthaydt\/automata-content\//,
        )
    }
  })

  test('writes a framework package name only in framework-packages.ts, so a rename is one edit', () => {
    const folder = resolve(SRC, 'shared/kit/player')
    const strip = (text: string): string => text.replace(/^(import|export)\b[^;'"]*?from\s+'[^']*'/gm, '')
    const offenders = readdirSync(folder).filter(
      (name) =>
        name !== 'framework-packages.ts' &&
        strip(readFileSync(resolve(folder, name), 'utf8')).includes(player.FRAMEWORK_PREFIX),
    )
    expect(offenders).toEqual([])
  })
})
