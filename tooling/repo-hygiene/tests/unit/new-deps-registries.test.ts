import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scopeRegistries } from '#src/new-deps-registries.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const folder = (npmrc?: string): string => {
  const root = mkdtempSync(join(tmpdir(), 'deps-registries-'))
  roots.push(root)
  if (npmrc !== undefined) writeFileSync(join(root, '.npmrc'), npmrc)
  return root
}

describe('scopeRegistries', () => {
  it('is empty when the repository has no .npmrc (every scope is on npmjs.org)', () => {
    expect(scopeRegistries(folder())).toEqual({})
  })

  it('reads each @scope:registry line and drops a trailing slash', () => {
    const root = folder('@acme:registry=https://npm.example.com/\n//npm.example.com/:_authToken=x\nfoo=bar\n')
    expect(scopeRegistries(root)).toEqual({ '@acme': 'https://npm.example.com' })
  })
})
