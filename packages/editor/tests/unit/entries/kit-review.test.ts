// The review entry (`@mcthaydt/automata-editor/kit/review`): the waiting changes and the editors they touch, over
// a GitHub API the host gives. It reaches no Node, no Effect, no DOM and no Svelte.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import * as review from '#src/entries/kit-review.ts'

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

describe('the kit review entry', () => {
  test('gives a host the list of waiting changes and the editors a change touches', () => {
    expect(Object.keys(review).sort()).toEqual(['editorsTouched', 'listWaiting'])
  })

  test('imports no Svelte component, no Node built-in and nothing from outside', () => {
    for (const file of reachable(resolve(SRC, 'entries/kit-review.ts'))) {
      expect(file.endsWith('.svelte'), file).toBe(false)
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^import[^']*?from\s+'([^']+)'/gm))
        expect(specifier, `${file} imports ${specifier}`).toMatch(/^\./)
    }
  })
})
