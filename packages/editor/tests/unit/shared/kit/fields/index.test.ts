// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import * as fields from '#src/shared/kit/fields/index.ts'

/** The kit's `fields` folder in `src/`. */
const FOLDER = new URL('../../../../../src/shared/kit/fields/', import.meta.url)

// A headless core (the 2D editor's model, a codec in Node) imports `@mcthaydt/automata-editor-kit/fields`: the field
// rules without the Svelte shell the package root also exports.
describe('the ./fields entry', () => {
  test('exports the rules, schemas and types of the typed fields', () => {
    for (const rule of [fields.checkFieldDef, fields.checkValues, fields.checkRetype, fields.renameField]) {
      expect(rule).toBeTypeOf('function')
    }
    expect(fields.entityDefShape.fields.safeParse).toBeTypeOf('function')
    expect(fields.HEX_COLOR.test('#00ff00')).toBe(true)
  })

  test('is a package export', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../../../package.json', import.meta.url), 'utf8'))
    expect(manifest.exports['./kit/fields']).toBe('./src/entries/kit-fields.ts')
  })

  test('imports only zod, the level format and its own folder, so a Node import never loads the shell', () => {
    const sources = readdirSync(FOLDER).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThan(1)
    for (const name of sources) {
      const text = readFileSync(new URL(name, FOLDER), 'utf8')
      const specifiers = [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1])
      for (const specifier of specifiers) {
        expect(
          specifier === 'zod' ||
            specifier === '@mcthaydt/automata-content/level-2d' ||
            specifier?.startsWith('./'),
        ).toBe(true)
      }
    }
  })
})
