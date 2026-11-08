// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BROWSER_ENGINES } from '@automata/vitest-preset/engines'
import { describe, expect, it } from 'vitest'
import { playgroundExamples } from '#src/shared/framework/examples.ts'
import { siteFacts } from '#src/shared/framework/facts.ts'
import { repositoryRoot } from '#src/shared/framework/root.ts'

// The numbers on Home are read from the workspace, never typed: the engines from the list every parity test runs in
// (plus Node), the examples from the catalogue the examples pages list, the licence from the root package.

describe('siteFacts', () => {
  const facts = siteFacts()

  it('counts the engines the parity tests run in, and Node', () => {
    expect(facts.engines.map((engine) => engine.id)).toEqual(['node', ...BROWSER_ENGINES])
  })

  it('says where each engine is checked', () => {
    expect(facts.engines.find((engine) => engine.id === 'node')?.where).toBe('unit tests')
    for (const id of BROWSER_ENGINES)
      expect(facts.engines.find((engine) => engine.id === id)?.where).toBe('parity job')
  })

  it('counts the examples the examples pages list', () => {
    expect(facts.examples).toBe(playgroundExamples().length)
  })

  it('reads the licence from the root package', () => {
    const root = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as { license: string }
    expect(facts.licence).toBe(root.license)
  })
})

describe('Home does not type a number', () => {
  it('has no count of engines, examples or targets in its words', () => {
    const folder = join(import.meta.dirname, '../../../src/features/home')
    for (const name of readdirSync(folder).filter((file) => /\.(svelte|ts)$/.test(file))) {
      const source = readFileSync(join(folder, name), 'utf8')
      expect(source, name).not.toMatch(/\b\d+ (engines?|examples?|targets?)\b/i)
    }
  })
})
