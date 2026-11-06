// @vitest-environment node
// patchToml's guards: a span edit that breaks the text, and a syntax tree whose positions do not slice to their
// literals, are refusals with no text (`verify-failed`), never a thrown error or a written file.
import { afterEach, describe, expect, it, vi } from 'vitest'

const broken = vi.hoisted(() => ({ scalar: false, positions: false }))

vi.mock('./toml-scalar', async (importOriginal) => {
  const original = await importOriginal<typeof import('./toml-scalar')>()
  return {
    ...original,
    writeTomlScalar: (...args: Parameters<typeof original.writeTomlScalar>) =>
      broken.scalar ? '= =' : original.writeTomlScalar(...args),
  }
})

vi.mock('./toml-literals', async (importOriginal) => {
  const original = await importOriginal<typeof import('./toml-literals')>()
  return {
    ...original,
    readTomlLiterals: (text: string) => {
      if (broken.positions) throw new original.TomlPositionError('TOML positions disagree at ["a"]')
      return original.readTomlLiterals(text)
    },
  }
})

afterEach(() => {
  broken.scalar = false
  broken.positions = false
})

describe('patchToml guards', () => {
  it('refuses with verify-failed when a span edit leaves text that is not TOML', async () => {
    const { patchToml } = await import('./patch-toml')
    broken.scalar = true
    expect(patchToml('a = 1\n', { a: 1 }, { a: 2 })).toMatchObject({
      ok: false,
      reason: 'verify-failed',
      path: [],
    })
  })

  it('refuses with verify-failed when the parser positions do not slice to their literals', async () => {
    const { patchToml } = await import('./patch-toml')
    broken.positions = true
    expect(patchToml('a = 1\n', { a: 1 }, { a: 2 })).toMatchObject({
      ok: false,
      reason: 'verify-failed',
      path: [],
    })
  })
})
