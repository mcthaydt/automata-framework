// @vitest-environment node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { describeStack, isCurrent, readFrameworkStack } from '../scripts/sync-stack'

// A throwaway repository stands in for the framework checkout, so the script is exercised with real git and no network.
const dirs: string[] = []
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

function repository(): { dir: string; commit: (message: string, files: Record<string, string>) => string } {
  const dir = mkdtempSync(join(tmpdir(), 'sync-stack-'))
  dirs.push(dir)
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' })
  git('init', '--quiet', '--initial-branch=main')
  return {
    dir,
    commit(message, files) {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(dir, path, '..'), { recursive: true })
        writeFileSync(join(dir, path), text)
      }
      git('add', '--all')
      git('commit', '--quiet', '-m', message)
      return git('rev-parse', 'HEAD').trim()
    },
  }
}

describe('describeStack', () => {
  it('records the framework commit and the sha256 of the text', () => {
    const source = describeStack('# What’s inside\n', 'abc123')
    expect(source).toEqual({
      repository: 'mcthaydt/automata-framework',
      path: 'docs/stack.md',
      commit: 'abc123',
      sha256: createHash('sha256').update('# What’s inside\n').digest('hex'),
    })
  })
})

describe('readFrameworkStack', () => {
  it('reads the page from the commit that last changed it, not from the newest commit', () => {
    const framework = repository()
    const first = framework.commit('docs: stack', { 'docs/stack.md': '# One\n' })
    framework.commit('feat: something else', { 'src/other.ts': 'export {}\n' })
    const { text, source } = readFrameworkStack(framework.dir, 'HEAD')
    expect(text).toBe('# One\n')
    expect(source.commit).toBe(first)
    expect(source.sha256).toBe(createHash('sha256').update('# One\n').digest('hex'))
  })

  it('follows the page when the framework changes it', () => {
    const framework = repository()
    framework.commit('docs: stack', { 'docs/stack.md': '# One\n' })
    const second = framework.commit('docs: stack again', { 'docs/stack.md': '# Two\n' })
    expect(readFrameworkStack(framework.dir, 'HEAD')).toMatchObject({ text: '# Two\n', source: { commit: second } })
  })

  it('says so when the ref has no stack page, instead of copying nothing', () => {
    const framework = repository()
    framework.commit('feat: no docs yet', { 'src/other.ts': 'export {}\n' })
    expect(() => readFrameworkStack(framework.dir, 'HEAD')).toThrow(/has no docs\/stack\.md/)
  })
})

describe('isCurrent', () => {
  const recorded = describeStack('# One\n', 'a'.repeat(40))
  it('is true for the same commit and text', () => {
    expect(isCurrent(recorded, describeStack('# One\n', 'a'.repeat(40)))).toBe(true)
  })
  it('is false when the framework moved the page, or the text differs', () => {
    expect(isCurrent(recorded, describeStack('# One\n', 'b'.repeat(40)))).toBe(false)
    expect(isCurrent(recorded, describeStack('# Two\n', 'a'.repeat(40)))).toBe(false)
  })
})
