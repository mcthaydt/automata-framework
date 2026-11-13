import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { packagesFromManifests } from '#src/collect.ts'
import { releaseTags } from '#src/release-tags.ts'

// The three states of the repository the tool must report truthfully, built in a real git repository so what is
// tested is what `git tag --list` says, not a stub of it. The retired scope's tags are spelled in another scope's
// name: the scope check forbids writing the retired one outside the history, and the tool must not care.
let root: string
const git = (...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'evidence-tags-'))
  git('init', '-q')
  writeFileSync(join(root, 'f'), 'x')
  git('add', 'f')
  git('commit', '-q', '-m', 'c')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const sim = { name: '@automata/sim', version: '0.1.0' }

describe('releaseTags', () => {
  it('reads every tag, whatever scope it is in, so the packages decide which are theirs', () => {
    git('tag', '@retired/automata-sim@0.0.2')
    git('tag', 'parked/some-branch')
    expect(releaseTags(root).sort()).toEqual(['@retired/automata-sim@0.0.2', 'parked/some-branch'])
  })

  it('today: only an older scope is tagged, so nothing is released and that is not an error', () => {
    git('tag', '@retired/automata-sim@0.0.2')
    expect(packagesFromManifests([sim], releaseTags(root))).toEqual([{ ...sim, released: false }])
  })

  it('after the scope is renamed: the same tags still say nothing of the new names is released', () => {
    git('tag', '@retired/automata-sim@0.0.2')
    const renamed = { name: '@automataframework/sim', version: '0.1.0' }
    expect(packagesFromManifests([renamed], releaseTags(root))).toEqual([{ ...renamed, released: false }])
  })

  it('after the first release: the release tag of the current name is found', () => {
    git('tag', '@retired/automata-sim@0.0.2')
    git('tag', '@automata/sim@0.1.0')
    expect(packagesFromManifests([sim], releaseTags(root))).toEqual([{ ...sim, released: true }])
  })

  it('a checkout with no tags at all still fails loudly, so a shallow clone cannot look unreleased', () => {
    expect(releaseTags(root)).toEqual([])
    expect(() => packagesFromManifests([sim], releaseTags(root))).toThrow(/no git tags/)
  })
})
