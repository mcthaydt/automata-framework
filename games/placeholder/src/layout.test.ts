import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

// GL spec §6.2 (GL.3): a game's page entry lives in `src/` with its role files, like EsperRedux.
describe('the placeholder layout', () => {
  it('keeps the page entry at src/main.ts, not at the game root', () => {
    expect(existsSync(join(root, 'src/main.ts'))).toBe(true)
    expect(existsSync(join(root, 'main.ts'))).toBe(false)
  })

  it('loads src/main.ts from index.html', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('<script type="module" src="./src/main.ts"></script>')
  })
})
