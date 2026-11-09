// The sync entry (`@mcthaydt/automata-editor/kit/sync`): GitHub sign-in, the sync loop and the merge by file kind,
// shared by the web editors and the Automata app. It takes its network, keychain, timers and git engine as arguments,
// so it reaches no Node, no Effect, no DOM and no Svelte.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import * as sync from '#src/entries/kit-sync.ts'

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

describe('the kit sync entry', () => {
  test('gives a host sign-in, the loop and the merges', () => {
    expect(Object.keys(sync).sort()).toEqual([
      'OfflineError',
      'SIGN_IN_WORDS',
      'STATUS_LINES',
      'generatedFolders',
      'generatedNote',
      'githubToken',
      'isGeneratedPath',
      'keepBothName',
      'mergeFile',
      'signIn',
      'startSync',
    ])
  })

  test('imports no Svelte component, no Node built-in, no Effect and nothing but the TOML reader from outside', () => {
    for (const file of reachable(resolve(SRC, 'entries/kit-sync.ts'))) {
      expect(file.endsWith('.svelte'), file).toBe(false)
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^import[^']*?from\s+'([^']+)'/gm))
        expect(specifier, `${file} imports ${specifier}`).toMatch(/^\.|^smol-toml$/)
    }
  })
})
