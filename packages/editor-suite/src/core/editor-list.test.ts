import { describe, expect, it } from 'vitest'
import { type EditorListLoad, loadEditorList } from './editor-list'

const ROW = `[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit", "ask"]
gates = []
checks = ["content"]
`

const problems = (load: EditorListLoad) => (load.ok ? [] : load.problems)
const where = (load: EditorListLoad) => problems(load).map((problem) => [problem.kind, problem.keyPath])

describe('loadEditorList', () => {
  it('loads a valid list', () => {
    const load = loadEditorList(`format = "af-editors/1"\n${ROW}`)
    expect(load.ok).toBe(true)
    expect(load.ok && load.list.file[0]?.editor).toBe('tuner')
  })

  it('reports a missing list', () => {
    const [problem] = problems(loadEditorList(undefined))
    expect(problem).toMatchObject({ kind: 'missing', keyPath: [] })
    expect(problem?.message).toContain('content/editors.toml')
  })

  it('reports a TOML syntax error with its line and column', () => {
    const [problem] = problems(loadEditorList('format = "af-editors/1"\n[[file]\nglob = 1\n'))
    expect(problem).toMatchObject({ kind: 'syntax', keyPath: [], line: 2 })
    expect(problem?.column).toBeGreaterThan(0)
  })

  it('reports a newer major format with the format found, and nothing else', () => {
    const load = loadEditorList(`format = "af-editors/2"\nfuture = true\n${ROW}`)
    expect(problems(load)).toEqual([
      expect.objectContaining({ kind: 'newer-format', keyPath: ['format'], format: 'af-editors/2' }),
    ])
  })

  it('reports a missing or foreign format as invalid at `format`', () => {
    expect(where(loadEditorList(ROW))).toEqual([['invalid', ['format']]])
    expect(where(loadEditorList(`format = "json"\n${ROW}`))).toEqual([['invalid', ['format']]])
    expect(where(loadEditorList(`format = "af-editors/0"\n${ROW}`))).toEqual([['invalid', ['format']]])
  })

  it('reports a row without gates at its key path (EDS-m)', () => {
    const load = loadEditorList(`format = "af-editors/1"\n${ROW.replace('gates = []\n', '')}`)
    expect(where(load)).toEqual([['invalid', ['file', 0, 'gates']]])
  })

  it('reports a check a row names that the list does not declare', () => {
    const load = loadEditorList(
      `format = "af-editors/1"\n${ROW.replace('["content"]', '["content", "lint"]')}`,
    )
    expect(where(load)).toEqual([['invalid', ['file', 0, 'checks', 1]]])
    expect(problems(load)[0]?.message).toContain('lint')
  })

  it('reports a gate a row names that the list does not declare: an editor never invents a gate', () => {
    const load = loadEditorList(`format = "af-editors/1"\n${ROW.replace('gates = []', 'gates = ["P-G1"]')}`)
    expect(where(load)).toEqual([['invalid', ['file', 0, 'gates', 0]]])
  })

  it('reports a repeated check or gate id, and a redeclared built-in `content` check', () => {
    const check = (id: string) => `[[check]]\nid = "${id}"\nrun = ["automata", "check"]\n`
    const gate = (id: string) => `[[gate]]\nid = "${id}"\nname = "G"\nrecords = "docs/**/gates.json"\n`
    expect(where(loadEditorList(`format = "af-editors/1"\n${ROW}${check('a')}${check('a')}`))).toEqual([
      ['invalid', ['check', 1, 'id']],
    ])
    expect(where(loadEditorList(`format = "af-editors/1"\n${ROW}${gate('G1')}${gate('G1')}`))).toEqual([
      ['invalid', ['gate', 1, 'id']],
    ])
    expect(where(loadEditorList(`format = "af-editors/1"\n${ROW}${check('content')}`))).toEqual([
      ['invalid', ['check', 0, 'id']],
    ])
  })

  it('reports every schema problem, not only the first', () => {
    const load = loadEditorList(
      `format = "af-editors/1"\n${ROW.replace('gates = []\n', '')}${ROW.replace('"tuner"', '""')}`,
    )
    expect(where(load)).toEqual([
      ['invalid', ['file', 0, 'gates']],
      ['invalid', ['file', 1, 'editor']],
    ])
  })
})
