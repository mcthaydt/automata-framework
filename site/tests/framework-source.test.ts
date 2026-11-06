// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { frameworkCommit, writeFrameworkRef } from '../scripts/framework-source'

// The site copies its example sources and demo bundles out of the sibling framework checkout. `framework.ref` names the
// commit those copies came from, and CI checks the framework out at that commit. A sync that records the checkout it
// actually read keeps the two from drifting apart.
const dirs: string[] = []
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'framework-source-'))
  dirs.push(dir)
  return dir
}

function repository(): { dir: string; git: (...args: string[]) => string } {
  const dir = temp()
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' })
  git('init', '--quiet', '--initial-branch=main')
  writeFileSync(join(dir, 'a.txt'), 'one')
  git('add', '--all')
  git('commit', '--quiet', '-m', 'first')
  return { dir, git }
}

describe('frameworkCommit', () => {
  it('is the checkout’s HEAD commit when the tree is clean', () => {
    const { dir, git } = repository()
    expect(frameworkCommit(dir)).toBe(git('rev-parse', 'HEAD').trim())
  })

  it('refuses a checkout with uncommitted changes, since the copy would not match the commit it records', () => {
    const { dir } = repository()
    writeFileSync(join(dir, 'a.txt'), 'edited')
    expect(() => frameworkCommit(dir)).toThrow(/uncommitted changes/)
  })

  it('refuses untracked files too, which a copy could have picked up', () => {
    const { dir } = repository()
    writeFileSync(join(dir, 'new.txt'), 'x')
    expect(() => frameworkCommit(dir)).toThrow(/uncommitted changes/)
  })

  it('says so when the folder is not a git checkout', () => {
    expect(() => frameworkCommit(temp())).toThrow(/not a git checkout/)
  })
})

describe('writeFrameworkRef', () => {
  it('writes the commit and a newline, which is what CI reads', () => {
    const site = temp()
    writeFrameworkRef(site, 'a'.repeat(40))
    expect(readFileSync(join(site, 'framework.ref'), 'utf8')).toBe(`${'a'.repeat(40)}\n`)
  })

  it('refuses anything that is not a full commit id', () => {
    expect(() => writeFrameworkRef(temp(), 'main')).toThrow(/40-character/)
  })
})
