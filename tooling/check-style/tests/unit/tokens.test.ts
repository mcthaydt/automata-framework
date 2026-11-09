import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { definedTokens, findUnknownTokens } from '#src/tokens.ts'

const known: ReadonlySet<string> = new Set(['--space-2', '--color-text-dim'])

describe('findUnknownTokens', () => {
  it('flags an editor var(--x) that the kit and the file do not define, once per use, with its line', () => {
    const css = '.a { gap: var(--space-2); color: var(--ink-3); }\n.b { color: var(--ink-3, #333) }\n'
    expect(findUnknownTokens('x.svelte', css, known)).toEqual([
      expect.objectContaining({ file: 'x.svelte', rule: 'unknown-token', line: 1 }),
      expect.objectContaining({ file: 'x.svelte', rule: 'unknown-token', line: 2 }),
    ])
    expect(findUnknownTokens('x.svelte', css, known)[0]?.message).toContain('--ink-3')
  })

  it('passes a token the kit defines, with or without a fallback', () => {
    const css = '.a { gap: var(--space-2); color: var(--color-text-dim, #888); }\n'
    expect(findUnknownTokens('x.css', css, known)).toEqual([])
  })

  it('passes a token the file itself defines, in a stylesheet or on an element', () => {
    const css = '.a { --plan-foot: 4px; bottom: var(--plan-foot); }\n'
    const markup =
      '<div style:--dock-lift={lift} style="--other: 1px"></div>\n<p style="top: var(--dock-lift) var(--other)"></p>\n'
    expect(findUnknownTokens('a.css', css, known)).toEqual([])
    expect(findUnknownTokens('a.svelte', markup, known)).toEqual([])
  })

  it('reads the names a file defines', () => {
    expect([...definedTokens('.a { --x: 1; --y-z : 2 }\n<i style:--w={1}></i>')].sort()).toEqual([
      '--w',
      '--x',
      '--y-z',
    ])
  })
})

describe('check-style --tokens', () => {
  const CLI = join(import.meta.dirname, '../../src/cli.ts')
  function tree(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'check-style-tokens-'))
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true })
      writeFileSync(join(dir, name), text)
    }
    return dir
  }

  it('fails on an unknown token in a root, and names it', () => {
    const dir = tree({
      'kit/tokens.css': ':root { --space-2: 8px; }\n',
      'app/Panel.svelte': '<p>x</p>\n<style>\n  p { gap: var(--space-9); }\n</style>\n',
    })
    const result = spawnSync(process.execPath, [CLI, '--tokens', 'kit', 'app'], {
      encoding: 'utf8',
      cwd: dir,
    })
    expect(result.stdout).toContain('app/Panel.svelte:3  unknown-token')
    expect(result.stdout).toContain('--space-9')
    expect(result.status).toBe(1)
  })

  it('passes a property one root file sets and another reads', () => {
    const dir = tree({
      'kit/tokens.css': ':root { --space-2: 8px; }\n',
      'app/Frame.svelte': '<div style="--plan-foot: 4px"></div>\n',
      'app/Pad.svelte': '<p>x</p>\n<style>\n  p { bottom: var(--plan-foot); }\n</style>\n',
    })
    const result = spawnSync(process.execPath, [CLI, '--tokens', 'kit', 'app'], {
      encoding: 'utf8',
      cwd: dir,
    })
    expect(result.status).toBe(0)
  })

  it('passes when every token is the kit’s or the root’s own', () => {
    const dir = tree({
      'kit/tokens.css': ':root { --space-2: 8px; }\n',
      'kit/Shell.svelte': '<div style:--dock-lift={0}></div>\n',
      'app/Panel.svelte':
        '<p>x</p>\n<style>\n  p { gap: var(--space-2); bottom: var(--dock-lift, 0px); }\n</style>\n',
    })
    const result = spawnSync(process.execPath, [CLI, '--tokens', 'kit', 'app'], {
      encoding: 'utf8',
      cwd: dir,
    })
    expect(result.status).toBe(0)
  })
})
