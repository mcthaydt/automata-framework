import { describe, expect, it } from 'vitest'
import { loadEditorList } from '#src/shared/editor-list/editor-list.ts'
import { editorRows, ensureListed, listGrowsBy } from '#src/shared/editor-list/editor-rows.ts'
import { EDITOR_LIST_PATH } from '#src/shared/editor-list/editors.schema.ts'

const BASE = `format = "af-editors/1"

[[file]]
glob = "content/levels/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`

const IDS = ['tuner', 'feel', 'audio', 'writer', 'sequence', 'schematic']

/** A workspace of one text file, with the mtime a write must expect. */
function workspace(initial: string | undefined) {
  let text = initial
  let mtime = 1
  const writes: string[] = []
  return {
    writes,
    get text() {
      return text
    },
    async read(path: string) {
      return path === EDITOR_LIST_PATH && text !== undefined ? { text, mtime } : undefined
    },
    async write(path: string, next: string, expected: { mtime: number } | 'absent') {
      writes.push(next)
      if (path !== EDITOR_LIST_PATH || expected === 'absent' || expected.mtime !== mtime)
        return { ok: false as const, reason: 'conflict' as const, message: 'changed' }
      text = next
      mtime += 1
      return { ok: true as const, mtime }
    },
  }
}

const globsOf = (text: string | undefined): string[] => {
  const load = loadEditorList(text ?? '')
  return load.ok ? load.list.file.map((row) => row.glob) : []
}

describe('each editor’s rows', () => {
  it.each(IDS)('%s’s rows load once appended to a list, with a comment above each', (id) => {
    const rows = editorRows(id)
    expect(rows).toBeDefined()
    const load = loadEditorList(`${BASE}\n${rows}`)
    expect(load.ok).toBe(true)
    if (!load.ok) return
    const added = load.list.file.filter((row) => row.editor === id)
    expect(added.length).toBeGreaterThan(0)
    for (const row of added) {
      expect(row.modes).toEqual(['edit'])
      expect(row.gates).toEqual([])
    }
    expect(rows?.trimStart().startsWith('#')).toBe(true)
  })

  it('names exactly the globs of each editor', () => {
    const globs = (id: string) => globsOf(`${BASE}\n${editorRows(id)}`).slice(1)
    expect(globs('tuner')).toEqual(['content/controls.toml', 'content/tuning.toml'])
    expect(globs('feel')).toEqual(['content/feel/*.toml'])
    expect(globs('audio')).toEqual(['content/audio/*.toml', 'assets/music/*'])
    expect(globs('writer')).toEqual(['content/lines/*.toml', 'content/dialogue/*.toml'])
    expect(globs('sequence')).toEqual(['content/cutscenes/*.toml'])
    expect(globs('schematic')).toEqual([
      'content/systems/*.toml',
      'content/nav/*.toml',
      'content/puzzles/*.toml',
    ])
  })

  it('checks the content of the Tuner’s and Schematic’s files only', () => {
    const checks = (id: string) => {
      const load = loadEditorList(`${BASE}\n${editorRows(id)}`)
      return load.ok ? load.list.file.filter((row) => row.editor === id).map((row) => row.checks) : []
    }
    for (const row of checks('tuner')) expect(row).toEqual(['content'])
    for (const row of checks('schematic')) expect(row).toEqual(['content'])
    for (const id of ['feel', 'audio', 'writer', 'sequence'])
      for (const row of checks(id)) expect(row).toEqual([])
  })

  it('has none for an editor it does not know', () => {
    expect(editorRows('levels-2d')).toBeUndefined()
    expect(editorRows('nope')).toBeUndefined()
  })
})

describe('ensureListed', () => {
  it('appends exactly the editor’s rows and writes once', async () => {
    const ws = workspace(BASE)
    const result = await ensureListed(ws, 'feel')
    expect(result).toMatchObject({ ok: true })
    expect(ws.writes).toHaveLength(1)
    expect(ws.text?.startsWith(BASE)).toBe(true)
    expect(globsOf(ws.text)).toEqual(['content/levels/*.af2d.json', 'content/feel/*.toml'])
  })

  it('writes nothing when the list has every glob of the editor', async () => {
    const ws = workspace(`${BASE}\n${editorRows('feel')}`)
    const result = await ensureListed(ws, 'feel')
    expect(result).toEqual({ ok: true, unchanged: true })
    expect(ws.writes).toEqual([])
  })

  it('adds only the glob a list lacks of an editor with two', async () => {
    const audio = `${BASE}
[[file]]
glob = "content/audio/*.toml"
editor = "audio"
modes = ["edit"]
gates = []
checks = []
`
    const ws = workspace(audio)
    await ensureListed(ws, 'audio')
    expect(globsOf(ws.text)).toEqual(['content/levels/*.af2d.json', 'content/audio/*.toml', 'assets/music/*'])
  })

  it('writes nothing for an editor it does not know', async () => {
    const ws = workspace(BASE)
    expect(await ensureListed(ws, 'nope')).toEqual({ ok: true, unchanged: true })
    expect(ws.writes).toEqual([])
  })

  it('starts no list for a game with none', async () => {
    const ws = workspace(undefined)
    expect(await ensureListed(ws, 'feel')).toEqual({ ok: true, unchanged: true })
    expect(ws.writes).toEqual([])
  })

  it('says so, and writes nothing, when the list cannot be read', async () => {
    const ws = workspace('format = "af-editors/1"\n[[file]]\nglob = 3\n')
    const result = await ensureListed(ws, 'feel')
    expect(result).toMatchObject({ ok: false })
    expect(ws.writes).toEqual([])
  })

  it('passes on a refused write', async () => {
    const ws = workspace(BASE)
    const stale = { ...ws, read: async () => ({ text: BASE, mtime: 99 }) }
    expect(await ensureListed(stale, 'feel')).toMatchObject({ ok: false, reason: 'conflict' })
  })
})

describe('listGrowsBy', () => {
  const grown = `${BASE}\n${editorRows('feel')}`

  it('is true when an editor’s rows are appended', () => {
    expect(listGrowsBy(BASE, grown)).toBe(true)
    expect(listGrowsBy(grown, `${grown}\n${editorRows('audio')}`)).toBe(true)
    expect(listGrowsBy(BASE, BASE)).toBe(true)
  })

  it('is false when a row is removed, edited or moved', () => {
    expect(listGrowsBy(grown, BASE)).toBe(false)
    expect(listGrowsBy(BASE, grown.replace('content/levels/*.af2d.json', 'content/levels/*.json'))).toBe(
      false,
    )
    expect(listGrowsBy(BASE, grown.replace('exports = "content"\n', ''))).toBe(false)
    const two = `${BASE}\n${editorRows('feel')}\n${editorRows('audio')}`
    const swapped = `${BASE}\n${editorRows('audio')}\n${editorRows('feel')}`
    expect(listGrowsBy(two, swapped)).toBe(false)
  })

  it('is false when the appended row has another glob or field', () => {
    const row = (glob: string, extra = '') =>
      `${BASE}\n[[file]]\nglob = "${glob}"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n${extra}`
    expect(listGrowsBy(BASE, row('src/**'))).toBe(false)
    expect(listGrowsBy(BASE, row('vite.config.ts'))).toBe(false)
    expect(listGrowsBy(BASE, row('content/feel/*.toml'))).toBe(true)
    expect(listGrowsBy(BASE, row('content/feel/*.toml').replace('checks = []', 'checks = ["content"]'))).toBe(
      false,
    )
    expect(listGrowsBy(BASE, row('content/feel/*.toml').replace('editor = "feel"', 'editor = "audio"'))).toBe(
      false,
    )
    expect(listGrowsBy(BASE, row('content/feel/*.toml', 'exports = "content"\n'))).toBe(false)
  })

  it('is false when a check, a gate, never or generated is appended', () => {
    expect(listGrowsBy(BASE, `${grownCheck()}`)).toBe(false)
    expect(listGrowsBy(BASE, `${grown}\n[[gate]]\nid = "g"\nname = "G"\nrecords = "gates/*.json"\n`)).toBe(
      false,
    )
    expect(listGrowsBy(BASE, `${grown}\nnever = ["src/**"]\n`)).toBe(false)
    expect(listGrowsBy(BASE, `${grown}\ngenerated = ["content/generated/**"]\n`)).toBe(false)
    function grownCheck(): string {
      return `${grown}\n[[check]]\nid = "boom"\nrun = ["rm", "-rf", "."]\n`
    }
  })

  it('is false when the text does not load', () => {
    expect(listGrowsBy(BASE, 'format = ')).toBe(false)
    expect(listGrowsBy('format = ', BASE)).toBe(false)
  })
})
