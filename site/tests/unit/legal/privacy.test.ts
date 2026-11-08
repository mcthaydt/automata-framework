import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Privacy from '#src/features/legal/Privacy.svelte'

/** The one key the editor writes, read from the editor's own source so the two cannot drift. */
function editorStorageKeys(): string[] {
  const source = readFileSync(
    resolve(process.cwd(), '../packages/editor/src/shared/kit/theme/theme-choice.ts'),
    'utf8',
  )
  return Array.from(source.matchAll(/THEME_KEY\s*=\s*'([^']+)'/g), (match) => match[1])
}

describe('Privacy and the try-it editor', () => {
  it('names the key the try-it keeps, and says its levels are not kept', () => {
    const keys = editorStorageKeys()
    expect(keys).not.toEqual([])
    const text = render(Privacy).container.textContent ?? ''
    for (const key of keys) expect(text, key).toContain(key)
    expect(text).toContain('levels you make stay in the page')
    expect(text).not.toContain('keeps the levels you make')
  })
})
