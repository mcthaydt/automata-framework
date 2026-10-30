import { defineSuiteEditor, type SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { describe, expect, it } from 'vitest'
import { createSuite } from './create-suite'

const editor = (id: string): SuiteEditor<unknown> =>
  defineSuiteEditor<unknown>({
    id,
    label: id,
    icon: id,
    hue: 'color/ed/tuner',
    open: async () => ({}),
    regions: { panel: () => {}, canvas: () => {}, inspector: () => {} } as never,
  })

describe('createSuite (editor suite spec §4.1)', () => {
  it('finds an installed editor by the id the list names', () => {
    const tuner = editor('tuner')
    const suite = createSuite({ editors: [tuner, editor('studio')] })
    expect(suite.editor('tuner')).toBe(tuner)
    expect(suite.editor('feel')).toBeUndefined()
  })

  it('refuses two editors with one id, naming it', () => {
    expect(() => createSuite({ editors: [editor('tuner'), editor('tuner')] })).toThrow(/tuner/)
  })
})
