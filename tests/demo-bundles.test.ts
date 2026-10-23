// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installDemoBundle } from '../scripts/sync-demos'

// A demo's built files have content hashes in their names, so copying a new build over the old one would leave the old
// build's files behind: published, unreferenced, and a second copy of the framework in every demo folder.
const dirs: string[] = []
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'demo-bundle-'))
  dirs.push(dir)
  return dir
}
const write = (root: string, path: string, content: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content)
}

describe('installDemoBundle', () => {
  it('replaces the previous build, so the old build’s hashed files do not stay behind', () => {
    const dist = temp()
    const target = temp()
    write(dist, 'index.html', 'new')
    write(dist, 'assets/index-NEW.js', 'new js')
    write(target, 'index.html', 'old')
    write(target, 'assets/index-OLD.js', 'old js')
    installDemoBundle(dist, target)
    expect(readFileSync(join(target, 'index.html'), 'utf8')).toBe('new')
    expect(readFileSync(join(target, 'assets/index-NEW.js'), 'utf8')).toBe('new js')
    expect(existsSync(join(target, 'assets/index-OLD.js'))).toBe(false)
  })

  it('creates the folder for a demo that has no bundle yet', () => {
    const dist = temp()
    write(dist, 'index.html', 'new')
    const target = join(temp(), 'not', 'there', 'yet')
    installDemoBundle(dist, target)
    expect(readFileSync(join(target, 'index.html'), 'utf8')).toBe('new')
  })

  it('refuses a build with no index.html and leaves the existing bundle alone', () => {
    const dist = temp()
    const target = temp()
    write(target, 'index.html', 'old')
    expect(() => installDemoBundle(dist, target)).toThrow(/no index\.html/)
    expect(readFileSync(join(target, 'index.html'), 'utf8')).toBe('old')
  })
})
