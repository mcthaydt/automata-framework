import { describe, expect, test, vi } from 'vitest'
import { createHistory, HistoryError } from '#src/shared/kit/history/history.ts'

interface Doc {
  readonly n: number
}
const doc = (n: number): Doc => ({ n })
const add =
  (by: number) =>
  (state: Doc): Doc => ({ n: state.n + by })

describe('History apply, undo and redo', () => {
  test('starts at the initial state with nothing to undo or redo', () => {
    const history = createHistory(doc(0))
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.undoLabel).toBeUndefined()
    expect(history.redoLabel).toBeUndefined()
    expect(history.revision).toBe(0)
  })

  test('apply records one labelled step', () => {
    const history = createHistory(doc(0))
    history.apply('Add 1', add(1))
    expect(history.state).toEqual({ n: 1 })
    expect(history.canUndo).toBe(true)
    expect(history.undoLabel).toBe('Add 1')
  })

  test('undo and redo walk the steps and name the next one', () => {
    const history = createHistory(doc(0))
    history.apply('Add 1', add(1))
    history.apply('Add 10', add(10))
    history.undo()
    expect(history.state).toEqual({ n: 1 })
    expect(history.undoLabel).toBe('Add 1')
    expect(history.redoLabel).toBe('Add 10')
    expect(history.canRedo).toBe(true)
    history.undo()
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)
    history.redo()
    history.redo()
    expect(history.state).toEqual({ n: 11 })
    expect(history.canRedo).toBe(false)
  })

  test('undo and redo with nothing to do change nothing and do not notify', () => {
    const history = createHistory(doc(0))
    const listener = vi.fn()
    history.subscribe(listener)
    history.undo()
    history.redo()
    expect(listener).not.toHaveBeenCalled()
    expect(history.revision).toBe(0)
  })

  test('an apply that returns the same state records nothing', () => {
    const history = createHistory(doc(0))
    const listener = vi.fn()
    history.subscribe(listener)
    history.apply('No change', (state) => state)
    expect(history.canUndo).toBe(false)
    expect(history.revision).toBe(0)
    expect(listener).not.toHaveBeenCalled()
  })

  test('a new step clears what could be redone', () => {
    const history = createHistory(doc(0))
    history.apply('Add 1', add(1))
    history.undo()
    expect(history.canRedo).toBe(true)
    history.apply('Add 5', add(5))
    expect(history.canRedo).toBe(false)
    expect(history.state).toEqual({ n: 5 })
  })

  test('the revision moves on every apply, undo and redo', () => {
    const history = createHistory(doc(0))
    history.apply('a', add(1))
    history.apply('b', add(1))
    history.undo()
    history.redo()
    expect(history.revision).toBe(4)
  })

  test('markClean makes the current revision clean; any later change is dirty, undoing back included', () => {
    const history = createHistory(doc(0))
    history.apply('a', add(1))
    history.markClean()
    expect(history.cleanRevision).toBe(history.revision)
    history.apply('b', add(1))
    expect(history.revision).not.toBe(history.cleanRevision)
    history.undo()
    expect(history.revision).not.toBe(history.cleanRevision)
  })

  test('subscribers hear each change with the history, and stop after they unsubscribe', () => {
    const history = createHistory(doc(0))
    const seen: number[] = []
    const stop = history.subscribe((h) => seen.push(h.state.n))
    history.apply('a', add(1))
    history.apply('b', add(1))
    history.undo()
    stop()
    history.redo()
    expect(seen).toEqual([1, 2, 1])
  })

  test('markClean notifies, so a "saved" indicator can follow it', () => {
    const history = createHistory(doc(0))
    const listener = vi.fn()
    history.subscribe(listener)
    history.markClean()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('History depth limit', () => {
  test('drops the oldest step silently; canUndo stays true until the last kept step is undone', () => {
    const history = createHistory(doc(0), { limit: 3 })
    for (let i = 1; i <= 5; i += 1) history.apply(`Add ${i}`, add(1))
    expect(history.state).toEqual({ n: 5 })
    history.undo()
    history.undo()
    expect(history.canUndo).toBe(true)
    history.undo()
    expect(history.state).toEqual({ n: 2 })
    expect(history.canUndo).toBe(false)
  })

  test('the default is 500 steps', () => {
    const history = createHistory(doc(0))
    for (let i = 0; i < 520; i += 1) history.apply('add', add(1))
    let undone = 0
    while (history.canUndo) {
      history.undo()
      undone += 1
    }
    expect(undone).toBe(500)
    expect(history.state).toEqual({ n: 20 })
  })
})

describe('History coalescing', () => {
  function clocked() {
    let now = 0
    const history = createHistory(doc(0), { now: () => now })
    return {
      history,
      advance(ms: number) {
        now += ms
      },
    }
  }

  test('applies with the same key inside the window are one step, labelled by the last', () => {
    const { history, advance } = clocked()
    history.apply('Set sink 1', add(1), { coalesce: 'sink' })
    advance(200)
    history.apply('Set sink 2', add(1), { coalesce: 'sink' })
    advance(200)
    history.apply('Set sink 3', add(1), { coalesce: 'sink' })
    expect(history.state).toEqual({ n: 3 })
    expect(history.undoLabel).toBe('Set sink 3')
    history.undo()
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)
  })

  test('the window runs from the last apply, so steady scrubbing stays one step', () => {
    const { history, advance } = clocked()
    for (let i = 0; i < 10; i += 1) {
      history.apply('scrub', add(1), { coalesce: 'sink' })
      advance(500)
    }
    history.undo()
    expect(history.state).toEqual({ n: 0 })
  })

  test('a pause longer than 600 ms starts a new step', () => {
    const { history, advance } = clocked()
    history.apply('first', add(1), { coalesce: 'sink' })
    advance(601)
    history.apply('second', add(1), { coalesce: 'sink' })
    history.undo()
    expect(history.state).toEqual({ n: 1 })
  })

  test('the window can be set', () => {
    let now = 0
    const history = createHistory(doc(0), { now: () => now, coalesceWindowMs: 50 })
    history.apply('first', add(1), { coalesce: 'sink' })
    now = 60
    history.apply('second', add(1), { coalesce: 'sink' })
    history.undo()
    expect(history.state).toEqual({ n: 1 })
  })

  test('a different key, or no key, is a new step', () => {
    const { history } = clocked()
    history.apply('sink', add(1), { coalesce: 'sink' })
    history.apply('haze', add(1), { coalesce: 'haze' })
    history.apply('plain', add(1))
    history.apply('plain again', add(1))
    let steps = 0
    while (history.canUndo) {
      history.undo()
      steps += 1
    }
    expect(steps).toBe(4)
  })

  test('an undo between two applies with the same key breaks the run', () => {
    const { history } = clocked()
    history.apply('a', add(1), { coalesce: 'sink' })
    history.undo()
    history.apply('b', add(1), { coalesce: 'sink' })
    history.undo()
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)
  })

  test('every coalesced apply moves the revision, so a save between two scrubs is dirty again', () => {
    const { history, advance } = clocked()
    history.apply('a', add(1), { coalesce: 'sink' })
    history.markClean()
    advance(100)
    history.apply('b', add(1), { coalesce: 'sink' })
    expect(history.revision).not.toBe(history.cleanRevision)
  })
})

describe('History transactions', () => {
  test('show live state to subscribers while open, and record one step on commit', () => {
    const history = createHistory(doc(0))
    const seen: number[] = []
    history.subscribe((h) => seen.push(h.state.n))
    const drag = history.begin('Drag layer')
    drag.update(add(1))
    drag.update(add(1))
    drag.update(add(1))
    expect(history.state).toEqual({ n: 3 })
    expect(history.canUndo).toBe(true)
    drag.commit()
    expect(seen).toEqual([1, 2, 3, 3])
    expect(history.undoLabel).toBe('Drag layer')
    history.undo()
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)
  })

  test('the revision moves on commit, not on each live update', () => {
    const history = createHistory(doc(0))
    const drag = history.begin('Drag')
    drag.update(add(1))
    drag.update(add(1))
    expect(history.revision).toBe(0)
    drag.commit()
    expect(history.revision).toBe(1)
  })

  test('cancel restores the state at begin and records nothing', () => {
    const history = createHistory(doc(7))
    const drag = history.begin('Drag')
    drag.update(add(5))
    drag.cancel()
    expect(history.state).toEqual({ n: 7 })
    expect(history.canUndo).toBe(false)
    expect(history.revision).toBe(0)
  })

  test('a transaction whose updates return the same state records nothing (identity, as for apply)', () => {
    const history = createHistory(doc(7))
    const drag = history.begin('Drag')
    drag.update((state) => state)
    drag.commit()
    expect(history.state).toEqual({ n: 7 })
    expect(history.canUndo).toBe(false)
    expect(history.revision).toBe(0)
  })

  test('a commit clears what could be redone', () => {
    const history = createHistory(doc(0))
    history.apply('a', add(1))
    history.undo()
    const drag = history.begin('Drag')
    drag.update(add(2))
    drag.commit()
    expect(history.canRedo).toBe(false)
  })

  test('a second begin throws a typed error and leaves the first transaction intact (EK-h)', () => {
    const history = createHistory(doc(0))
    const first = history.begin('First')
    first.update(add(1))
    expect(() => history.begin('Second')).toThrow(HistoryError)
    try {
      history.begin('Second')
    } catch (error) {
      expect((error as HistoryError).code).toBe('transaction-open')
    }
    expect(first.open).toBe(true)
    first.update(add(1))
    first.commit()
    expect(history.state).toEqual({ n: 2 })
    expect(history.undoLabel).toBe('First')
  })

  test('apply while a transaction is open throws the same error', () => {
    const history = createHistory(doc(0))
    history.begin('Drag')
    expect(() => history.apply('Other', add(1))).toThrow(HistoryError)
  })

  test('undo while open cancels the transaction and does nothing else', () => {
    const history = createHistory(doc(0))
    history.apply('Earlier', add(1))
    const drag = history.begin('Drag')
    drag.update(add(5))
    expect(history.canUndo).toBe(true)
    history.undo()
    expect(history.state).toEqual({ n: 1 })
    expect(drag.open).toBe(false)
    expect(history.undoLabel).toBe('Earlier')
    expect(history.canRedo).toBe(false)
  })

  test('redo while open does nothing', () => {
    const history = createHistory(doc(0))
    history.apply('a', add(1))
    history.undo()
    const drag = history.begin('Drag')
    drag.update(add(5))
    history.redo()
    expect(history.state).toEqual({ n: 5 })
    expect(drag.open).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  test('a transaction ended by undo, commit or cancel ignores every further call', () => {
    const history = createHistory(doc(0))
    const cancelled = history.begin('Drag')
    cancelled.update(add(5))
    history.undo()
    cancelled.update(add(5))
    cancelled.commit()
    cancelled.cancel()
    expect(history.state).toEqual({ n: 0 })
    expect(history.canUndo).toBe(false)

    const committed = history.begin('Drag')
    committed.update(add(2))
    committed.commit()
    committed.update(add(100))
    committed.commit()
    expect(history.state).toEqual({ n: 2 })
    history.undo()
    expect(history.canUndo).toBe(false)
  })

  test('a new transaction can begin once the last is closed', () => {
    const history = createHistory(doc(0))
    history.begin('One').cancel()
    expect(() => history.begin('Two')).not.toThrow()
  })

  test('cancel tells subscribers the state went back', () => {
    const history = createHistory(doc(0))
    const seen: number[] = []
    const drag = history.begin('Drag')
    drag.update(add(4))
    history.subscribe((h) => seen.push(h.state.n))
    drag.cancel()
    expect(seen).toEqual([0])
  })
})
