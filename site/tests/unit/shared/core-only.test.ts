// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Framework 233c9da (PRODUCT.5g): AF is core only; physics and its bodies-2d demo left for Automata Plus. The site
// must not offer either.
const OFFER = ['src', 'scripts', 'playground/src']

function files(path: string): string[] {
  try {
    return readdirSync(path, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name))
  } catch {
    return [path]
  }
}

describe('the site offers the core framework only', () => {
  for (const path of OFFER) {
    it(`${path} offers no physics package or bodies-2d demo`, () => {
      for (const file of files(path)) {
        const text = readFileSync(file, 'utf8')
        expect(text, file).not.toMatch(
          /automata-physics|bodies-2d|physics playground|room full of physics|Play with physics/i,
        )
      }
    })
  }
})
