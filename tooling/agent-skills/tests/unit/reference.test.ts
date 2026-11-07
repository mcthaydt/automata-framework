import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The API reference (`pnpm api-index --write`) is the one place an agent reads a signature. It is built from the
// emitted `.d.ts` files, so it shows declarations only: a body in it means a re-export was read from source.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const reference = readFileSync(join(root, 'agents/automata/skills/automata-api/reference/api.md'), 'utf8')

/**
 * The first code block of `name`'s entry in `pkg`'s section: the text between `## \`pkg\`` and the next `## `
 * heading, then `#### \`name\` (function)` and the ` ```ts ` block that follows it.
 */
function signatureIn(markdown: string, pkg: string, name: string): string | undefined {
  const start = markdown.indexOf(`\n## \`${pkg}\`\n`)
  if (start < 0) return undefined
  const rest = markdown.slice(start + 1)
  const end = rest.indexOf('\n## ', 3)
  const section = end < 0 ? rest : rest.slice(0, end)
  const heading = section.indexOf(`\n#### \`${name}\` (function)\n`)
  if (heading < 0) return undefined
  const open = section.indexOf('```ts\n', heading)
  const close = section.indexOf('\n```', open + 6)
  return section.slice(open + 6, close)
}

describe('the API reference', () => {
  it.each([
    'defineCommand',
    'defineComponent',
    'defineEvent',
    'definePlugin',
    'defineResource',
    'defineSystem',
  ])('%s reads the same in @automata/framework as in @automata/sim', (name) => {
    const inSim = signatureIn(reference, '@automata/sim', name)
    expect(inSim).toBeDefined()
    expect(signatureIn(reference, '@automata/framework', name)).toBe(inSim)
  })

  it('has no code with a function body', () => {
    // A .d.ts never holds a statement; the six definers' bodies used to leak in through the framework's re-exports.
    expect(reference.split('\n').filter((line) => /^\s+return /.test(line))).toEqual([])
  })
})
