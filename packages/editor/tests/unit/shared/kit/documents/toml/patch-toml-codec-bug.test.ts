// @vitest-environment node
// The guard behind patchToml: when toml-patch writes a text that does not read as the new value, the result is
// refused with verify-failed and no text, never returned.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@decimalturn/toml-patch', async (importOriginal) => {
  const original = await importOriginal<typeof import('@decimalturn/toml-patch')>()
  // A broken toml-patch: it writes the text it was given, dropping the change.
  return { ...original, patch: (existing: string) => existing }
})

describe('patchToml with a broken toml-patch', () => {
  it('refuses with verify-failed at the first value that reads wrong', async () => {
    const { patchToml } = await import('#src/shared/kit/documents/toml/patch-toml.ts')
    const result = patchToml('[a]\nb = 1\n', { a: { b: 1 } }, { a: { b: 1, c: 2 } })
    expect(result).toMatchObject({ ok: false, reason: 'verify-failed', path: ['a', 'c'] })
  })
})
