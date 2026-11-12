import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildFonts } from '#src/shared/assets/build-fonts.ts'

// The examples' fonts, built again, are byte for byte the committed files served beside each language example's page
// (`core/languages/` and `core/first-run/`, which load `fonts.css` from there), as the atlas is kept. The build reads
// `examples/2d/content/fonts.toml` and holds every word the examples show, the framework's menus included, to the faces,
// so a menu in Japanese, Korean or Chinese draws in the pixel font and never in a device's. It lives here, not beside the
// examples, because a file in an examples module folder is an example.
const EXAMPLES = join(import.meta.dirname, '../../../../../../examples/2d')
const PAGES = ['core/languages', 'core/first-run']

describe("the examples' fonts", () => {
  it('are fresh: rebuilding them gives the committed bytes, in each page folder', async () => {
    const { files } = await Effect.runPromise(buildFonts({ root: EXAMPLES, schemas: [] }))
    expect([...files.keys()].filter((name) => name.endsWith('.woff2'))).not.toHaveLength(0)
    for (const page of PAGES)
      for (const [name, bytes] of files)
        expect(new Uint8Array(readFileSync(join(EXAMPLES, 'public', page, name))), `${page}/${name}`).toEqual(
          bytes,
        )
  })

  it('serve all six languages, each in a face of its own, and ship the licence beside the subsets', async () => {
    const { files } = await Effect.runPromise(buildFonts({ root: EXAMPLES, schemas: [] }))
    const css = new TextDecoder().decode(files.get('fonts.css'))
    for (const language of ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
      expect(css, language).toContain(`:root:lang(${language})`)
    expect([...files.keys()].filter((name) => name.endsWith('-OFL.txt')).sort()).toEqual([
      'ja-OFL.txt',
      'ko-OFL.txt',
      'zh-hans-OFL.txt',
    ])
  })
})
