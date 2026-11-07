import type { Feel } from '@mcthaydt/automata-feel'
import { describe, expect, it, type Mock, vi } from 'vitest'
import { feelBoard } from './feel-board'

const feel = (): Feel & { hear: Mock<Feel['hear']> } => ({
  hear: vi.fn<Feel['hear']>(),
  frame: vi.fn(),
  frameNow: vi.fn(),
})

describe('feelBoard', () => {
  it('lists the events the content reacts to, once each', () => {
    const board = feelBoard(
      () => ({ entry: [{ on: 'hit' }, { on: 'door.*' }, { on: 'hit' }] }),
      feel(),
      () => 7,
    )
    expect(board.entries()).toEqual(['hit', 'door.*'])
  })
  it('fires an entry by hearing its event at the current tick', () => {
    const f = feel()
    feelBoard(
      () => ({ entry: [{ on: 'hit' }] }),
      f,
      () => 7,
    ).fire('hit')
    expect(f.hear).toHaveBeenCalledWith(7, [{ type: 'hit', payload: null }])
  })
  it('turns a pattern into a concrete event id', () => {
    const f = feel()
    feelBoard(
      () => ({ entry: [{ on: 'door.*' }] }),
      f,
      () => 0,
    ).fire('door.*')
    expect(f.hear).toHaveBeenCalledWith(0, [{ type: 'door.x', payload: null }])
  })
  it('reads the content each time, so a reload shows', () => {
    let content = { entry: [{ on: 'a' }] }
    const board = feelBoard(
      () => content,
      feel(),
      () => 0,
    )
    content = { entry: [{ on: 'b' }] }
    expect(board.entries()).toEqual(['b'])
  })
})
