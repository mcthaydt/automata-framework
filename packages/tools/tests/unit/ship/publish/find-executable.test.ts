import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findExecutable } from '#src/features/ship/publish/find-executable.ts'

function folder(files: Record<string, number>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-find-executable-'))
  for (const [name, mode] of Object.entries(files)) {
    writeFileSync(join(dir, name), '#!/bin/sh\n')
    chmodSync(join(dir, name), mode)
  }
  return dir
}

describe('findExecutable', () => {
  it('finds the first executable of that name on PATH, without running it', () => {
    const first = folder({ butler: 0o755 })
    const second = folder({ butler: 0o755 })
    expect(findExecutable('butler', [first, second].join(delimiter), 'linux')).toBe(join(first, 'butler'))
  })

  it('skips a file that is not executable, a folder and an empty PATH entry', () => {
    const plain = folder({ butler: 0o644 })
    const withFolder = folder({})
    mkdirSync(join(withFolder, 'butler'))
    const real = folder({ butler: 0o755 })
    expect(findExecutable('butler', ['', plain, withFolder, real].join(delimiter), 'linux')).toBe(
      join(real, 'butler'),
    )
  })

  it('returns undefined when no folder has it', () => {
    expect(findExecutable('butler', folder({ other: 0o755 }), 'linux')).toBeUndefined()
    expect(findExecutable('butler', '', 'linux')).toBeUndefined()
  })

  it('tries the Windows extensions on win32', () => {
    const dir = folder({ 'butler.exe': 0o755 })
    expect(findExecutable('butler', dir, 'win32')).toBe(join(dir, 'butler.exe'))
  })
})
