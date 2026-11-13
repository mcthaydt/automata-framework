import { describe, expect, it } from 'vitest'
import packageFile from '../../../package.json' with { type: 'json' }

// A game's Vite config registers content kinds under Node, where the credits panel's Svelte file cannot load. So the `credits`
// kind has an entry of its own, `@automata/ui-screens/content` (as `@automata/hud/content` does for the hud file), that imports no
// Svelte; `@automata/ui-screens/credits` keeps exporting it beside the panel.

interface Exports {
  readonly [key: string]: string | { readonly [condition: string]: string }
}
const pkg = packageFile as unknown as { exports: Exports; publishConfig: { exports: Exports } }

describe('@automata/ui-screens/content', () => {
  it('is an export with no svelte condition, in the source and the published map', () => {
    expect(pkg.exports['./content']).toBe('./src/entries/content.ts')
    expect(pkg.publishConfig.exports['./content']).toEqual({
      types: './dist/entries/content.d.ts',
      import: './dist/entries/content.js',
    })
  })

  it('gives the credits kind and its schema, and not the panel', async () => {
    const entry = await import('#src/entries/content.ts')
    expect(Object.keys(entry).sort()).toEqual(['creditsContent', 'creditsSchema', 'creditsSchemaWith'])
    expect(entry.creditsContent.kind).toBe('credits')
  })

  it('is the same kind the credits entry gives beside the panel', async () => {
    const [content, credits] = await Promise.all([
      import('#src/entries/content.ts'),
      import('#src/entries/credits.ts'),
    ])
    expect(content.creditsContent).toBe(credits.creditsContent)
  })
})
