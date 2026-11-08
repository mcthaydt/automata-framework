// The model layer builds on the kit's History and Selection through the shell-free `./core` entry: this is the one place
// the package proves that the entry loads on Node and does what the editor needs of it.
import { createHistory, createSelection } from '@mcthaydt/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'

describe('the kit core entry, from editor-3d', () => {
  it('gives a history whose undo restores the previous state', () => {
    const history = createHistory({ n: 1 })
    history.apply('one more', (state) => ({ n: state.n + 1 }))
    expect(history.state).toEqual({ n: 2 })
    history.undo()
    expect(history.state).toEqual({ n: 1 })
  })

  it('gives a selection that keeps the last id as the primary', () => {
    const selection = createSelection<string>()
    selection.set(['sector:hall', 'wall:hall/1'])
    expect(selection.primary).toBe('wall:hall/1')
  })
})
