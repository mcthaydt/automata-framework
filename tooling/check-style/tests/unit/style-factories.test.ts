import { describe, expect, test } from 'vitest'
import { checkFile } from '#src/style.ts'

// An extension that takes options exports `create<Name>(options)` and the function returns the role's `define*` result.
// That counts as exporting the result, so the role suffix still names what the file holds.

const factory = (name: string, body: string): string =>
  `import { definePlugin } from 'x'\nexport function ${name}(o: { n: number }) {\n${body}\n}\n`

describe('a role file may export a factory', () => {
  test('a create function that returns a definePlugin call is a plugin', () => {
    const code = factory('createCutscenes', "  return definePlugin({ name: 'cutscenes' + o.n })")
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toEqual([])
  })

  test('an arrow function with the call as its body is a plugin too', () => {
    const code =
      "import { definePlugin } from 'x'\nexport const createCutscenes = (n: number) => definePlugin({ name: String(n) })\n"
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toEqual([])
  })

  test('a create function that returns something else still gives role-missing', () => {
    const code = factory('createCutscenes', '  return { name: o.n }')
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toMatchObject([{ rule: 'role-missing' }])
  })

  test('a create function with one return that is not the role call gives role-missing', () => {
    const code = factory(
      'createCutscenes',
      "  if (o.n > 1) return { name: 'a' }\n  return definePlugin({ name: 'b' })",
    )
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toMatchObject([{ rule: 'role-missing' }])
  })

  test('the function may have any name: navWalkSystem(options) returns defineSystem', () => {
    const code =
      "import { defineSystem } from 'x'\nexport const navWalkSystem = (o: number) => defineSystem('nav', 'gameplay', () => o)\n"
    expect(checkFile('/p/src/nav.system.ts', code)).toEqual([])
  })

  test('an object with the define call as a member counts', () => {
    const code = factory(
      'createCutscenes',
      "  return { options: o, plugin: definePlugin({ name: 'cutscenes' }) }",
    )
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toEqual([])
  })

  test('a helper in a file with no role suffix is not flagged', () => {
    const code = factory('makeCutscenes', "  return definePlugin({ name: 'cutscenes' })")
    expect(checkFile('/p/src/helpers.ts', code)).toEqual([])
  })

  test('a factory in a file with the wrong suffix still names the suffix it needs', () => {
    const code = factory('createCutscenes', "  return definePlugin({ name: 'cutscenes' })")
    expect(checkFile('/p/src/cutscenes.system.ts', code)).toMatchObject([{ rule: 'role-mismatch' }])
  })

  test('a define result exported directly stays fine', () => {
    const code =
      "import { definePlugin } from 'x'\nexport const cutscenes = definePlugin({ name: 'cutscenes' })\n"
    expect(checkFile('/p/src/cutscenes.plugin.ts', code)).toEqual([])
  })
})
