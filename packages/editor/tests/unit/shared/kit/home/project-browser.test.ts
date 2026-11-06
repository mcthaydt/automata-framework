import { describe, expect, it, vi } from 'vitest'
import { type BrowserState, createProjectBrowser } from '#src/shared/kit/home/project-browser.ts'
import { StorageError } from '#src/shared/kit/storage/project-store.ts'

// The list state machine both editors' Home controllers are built on (moved from editor-2d's `home-controller.ts`,
// ED3D.5c). A hand-held `list` lets each test decide when a listing comes back and what it holds.

interface Entry {
  readonly path: string
  readonly label: string
}
const entry = (path: string, label = path): Entry => ({ path, label })

function setup(first: readonly Entry[] = [entry('a'), entry('b'), entry('c')]) {
  let next: () => Promise<readonly Entry[]> = async () => first
  const errors: string[] = []
  const browser = createProjectBrowser<Entry, 'open' | 'import'>({
    list: () => next(),
    words: (item) => [item.path, item.label],
    onError: (message) => errors.push(message),
  })
  const seen: BrowserState<Entry, 'open' | 'import'>[] = []
  browser.state.subscribe((state) => seen.push(state))
  return {
    browser,
    errors,
    seen,
    listWith(run: () => Promise<readonly Entry[]>) {
      next = run
    },
  }
}

describe('createProjectBrowser', () => {
  it('starts loading with nothing, then shows the listing with the first entry selected', async () => {
    const { browser, seen } = setup()
    expect(seen[0]).toMatchObject({ phase: 'loading', entries: [], selected: undefined, busy: undefined })
    await browser.refresh()
    expect(browser.current).toMatchObject({ phase: 'ready', selected: 'a', message: undefined })
    expect(browser.current.visible).toBe(browser.current.entries)
  })

  it('is unavailable with the store’s words when the listing fails, and loading again on the next refresh', async () => {
    const { browser, listWith, seen } = setup()
    listWith(async () => {
      throw new StorageError('denied', 'The folder needs permission again.')
    })
    await browser.refresh()
    expect(browser.current).toMatchObject({
      phase: 'unavailable',
      entries: [],
      selected: undefined,
      message: 'The folder needs permission again.',
    })
    listWith(async () => [entry('z')])
    const retried = browser.refresh()
    expect(seen.at(-1)).toMatchObject({ phase: 'loading', message: undefined })
    await retried
    expect(browser.current).toMatchObject({ phase: 'ready', selected: 'z' })
  })

  it('never lets an older listing replace a newer one', async () => {
    const { browser, listWith } = setup()
    let release: (entries: readonly Entry[]) => void = () => {}
    listWith(() => new Promise((resolve) => (release = resolve)))
    const slow = browser.refresh()
    listWith(async () => [entry('new')])
    await browser.refresh()
    release([entry('old')])
    await slow
    expect(browser.current.entries.map((e) => e.path)).toEqual(['new'])
  })

  it('keeps a selection that is still listed, and takes the one `prefer` names', async () => {
    const { browser, listWith } = setup()
    await browser.refresh()
    browser.select('b')
    listWith(async () => [entry('b'), entry('c'), entry('d')])
    await browser.load()
    expect(browser.current.selected).toBe('b')
    await browser.load((visible) => visible.find((e) => e.path === 'd')?.path)
    expect(browser.current.selected).toBe('d')
    await browser.load(() => undefined)
    expect(browser.current.selected).toBe('d')
  })

  it('searches through the words of each entry, keeping the selection while it shows', async () => {
    const { browser } = setup([entry('a', 'Depot'), entry('b', 'Clinic'), entry('c', 'Depot yard')])
    await browser.refresh()
    browser.select('c')
    browser.search('depot')
    expect(browser.current.visible.map((e) => e.path)).toEqual(['a', 'c'])
    expect(browser.current).toMatchObject({ query: 'depot', selected: 'c' })
    browser.search('clinic')
    expect(browser.current.selected).toBe('b')
    browser.search('nothing')
    expect(browser.current.selected).toBeUndefined()
  })

  it('selects only what is shown, and steps through the shown entries', async () => {
    const { browser } = setup()
    await browser.refresh()
    browser.select('nowhere')
    expect(browser.current.selected).toBe('a')
    browser.step('End')
    expect(browser.current.selected).toBe('c')
    browser.step('ArrowLeft')
    expect(browser.current.selected).toBe('b')
  })

  it('runs one action at a time, marks it busy, and tells a throw through onError', async () => {
    const { browser, errors } = setup()
    let finish: () => void = () => {}
    const second = vi.fn(async () => {})
    const first = browser.run('open', () => new Promise<void>((resolve) => (finish = resolve)))
    expect(browser.current.busy).toBe('open')
    await browser.run('import', second)
    expect(second).not.toHaveBeenCalled()
    finish()
    await first
    expect(browser.current.busy).toBeUndefined()
    await browser.run('import', async () => {
      throw new Error('the disk is gone')
    })
    expect(errors).toEqual(['Something went wrong: the disk is gone'])
    expect(browser.current.busy).toBeUndefined()
  })
})
