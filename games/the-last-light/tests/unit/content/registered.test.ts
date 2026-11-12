import { readdirSync } from 'node:fs'
import { join, parse } from 'node:path'
import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'

// A file under content/ of a kind nobody registered with the content plugin is skipped without a word, and the sim then plays on
// the defaults (peek.toml and carried-light.toml were skipped that way for a whole task). This holds every file the game keeps:
// each is compiled by some kind, or is one of the few the game reads another way and says so here.

const ROOT = join(import.meta.dirname, '../../../content')
const kinds = content as unknown as Record<string, Record<string, unknown> | undefined>

/** What is under content/ that the compiler does not take, and why. */
const READ_ANOTHER_WAY: Readonly<Record<string, string>> = {
  'editors.toml': 'the suite reads it to know which editor opens which file',
  generated: 'the compiler writes it (the types of the compiled content)',
  levels: 'the 3D level is imported as the file the editor saves (app/content.ts, features/room/room.ts)',
}

/** The files of each folder of content/ by their stem, and the root's own files, which are kinds of their own. */
function layout(): { readonly folders: Map<string, string[]>; readonly root: string[] } {
  const folders = new Map<string, string[]>()
  const root: string[] = []
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (Object.hasOwn(READ_ANOTHER_WAY, entry.name)) continue
    if (entry.isDirectory())
      folders.set(
        entry.name,
        readdirSync(join(ROOT, entry.name)).map((file) => parse(file).name),
      )
    else root.push(parse(entry.name).name)
  }
  return { folders, root }
}

const { folders, root } = layout()

describe('every file under content/', () => {
  it('is more than the few this test knows', () => {
    expect(folders.size).toBeGreaterThan(8)
    expect(root.length).toBeGreaterThan(2)
  })

  for (const stem of root)
    it(`content/${stem}.toml is a compiled kind of its own`, () => {
      expect(
        Object.hasOwn(kinds, stem),
        `no kind compiled content/${stem}.toml: register it in vite.config.ts`,
      ).toBe(true)
    })

  for (const [folder, stems] of folders)
    it(`content/${folder}/ is compiled by one kind, every file of it`, () => {
      const compiledBy = Object.entries(kinds).find(
        ([, kind]) => kind !== undefined && stems.every((stem) => Object.hasOwn(kind, stem)),
      )
      expect(
        compiledBy,
        `no kind compiled all of content/${folder}/: register its kind in vite.config.ts`,
      ).toBeDefined()
    })
})
