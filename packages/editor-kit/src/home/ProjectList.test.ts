import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectList from './ProjectList.svelte'
import type { HomeCard } from './project-browse'

// The listbox of projects (plan ED2D.4c2a, decision 3; moved from editor-2d in ED3D.5c). The cards are written by hand,
// as an editor would make them from its entries, so each state is exact.

const NOW = 1_700_000_000_000
const KIND = 'Level project'
const OTHER = 'Planted note'

const card = (path: string, over: Partial<HomeCard> = {}): HomeCard => ({
  path,
  title: path.slice(path.lastIndexOf('/') + 1),
  badge: { tone: 'ok', text: 'Valid' },
  kind: KIND,
  accent: '--color-layer-tiles',
  size: 4300,
  mtime: NOW - 5 * 60_000,
  ...over,
})
const mossgate = card('mossgate.af2d.json', { title: 'Mossgate' })
const notes = card('notes/draft.note', {
  kind: OTHER,
  accent: '--color-layer-sky',
  badge: { tone: 'warn', text: '1 warning' },
  size: 812,
})
const broken = card('torn.af2d.json', {
  badge: { tone: 'bad', text: 'Can’t open' },
  size: 90,
  mtime: NOW - 3 * 3_600_000,
})
const either = card('stage.toml', {
  kind: `${KIND} or ${OTHER}`,
  accent: undefined,
  badge: { tone: 'neutral', text: 'Choose a profile' },
  size: 2048,
  mtime: NOW - 86_400_000 * 1.5,
})

function mount(props: Partial<Parameters<typeof render<typeof ProjectList>>[1]> = {}) {
  const handlers = {
    onselect: vi.fn(),
    onstep: vi.fn(),
    onopen: vi.fn(),
    ondelete: vi.fn(),
    onclear: vi.fn(),
  }
  const visible = [mossgate, notes, broken, either]
  const view = render(ProjectList, {
    loading: false,
    total: visible.length,
    visible,
    selected: undefined,
    query: '',
    emptyHint: 'Pick a template below to start one.',
    now: NOW,
    ...handlers,
    ...props,
  })
  return { ...handlers, ...view }
}

const list = (): HTMLElement => screen.getByRole('listbox', { name: 'Projects' })
const option = (name: RegExp | string): HTMLElement => screen.getByRole('option', { name })

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('ProjectList', () => {
  describe('the listbox', () => {
    it('is one listbox of options in list order, and one tab stop', () => {
      mount()
      expect(within(list()).getAllByRole('option')).toHaveLength(4)
      expect(list()).toHaveAttribute('tabindex', '0')
      for (const card of within(list()).getAllByRole('option')) expect(card).not.toHaveAttribute('tabindex')
    })

    it('marks the selected card and points the listbox at it', () => {
      mount({ selected: 'notes/draft.note' })
      expect(option(/draft\.note/)).toHaveAttribute('aria-selected', 'true')
      expect(option(/Mossgate/)).toHaveAttribute('aria-selected', 'false')
      expect(list()).toHaveAttribute('aria-activedescendant', option(/draft\.note/).id)
    })

    it('points at nothing when nothing is selected', () => {
      mount()
      expect(list()).not.toHaveAttribute('aria-activedescendant')
    })
  })

  describe('a card', () => {
    it('shows the title, its kind, badge, file, size and age', () => {
      mount()
      const card = option(/Mossgate/)
      expect(card).toHaveTextContent('Mossgate')
      expect(card).toHaveTextContent(KIND)
      expect(card).toHaveTextContent('Valid')
      expect(card).toHaveTextContent('mossgate.af2d.json')
      expect(card).toHaveTextContent('4.2 KB')
      expect(card).toHaveTextContent('5 min ago')
    })

    it('keeps the folder apart from the file name', () => {
      mount()
      const card = option(/draft\.note/)
      expect(within(card).getByText('draft.note', { selector: '.file' })).toBeInTheDocument()
      expect(within(card).getByText('notes/', { selector: '.dir' })).toBeInTheDocument()
      expect(card).toHaveTextContent('1 warning')
      expect(card).toHaveTextContent('812 B')
    })

    it('shows the badge and the kind it is given', () => {
      mount()
      expect(option(/torn\.af2d\.json/)).toHaveTextContent('Can’t open')
      expect(option(/torn\.af2d\.json/)).toHaveTextContent('3 h ago')
      const undecided = option(/stage\.toml/)
      expect(undecided).toHaveTextContent('Choose a profile')
      expect(undecided).toHaveTextContent(`${KIND} or ${OTHER}`)
      expect(undecided).toHaveTextContent('yesterday')
    })

    it('has a tile with the initial of its title, upper case', () => {
      mount()
      const tile = (card: HTMLElement): string | null | undefined => card.querySelector('.tile')?.textContent
      expect(tile(option(/Mossgate/))).toBe('M')
      expect(tile(option(/draft\.note/))).toBe('D')
      expect(option(/Mossgate/).querySelector('.tile')).toHaveAttribute('aria-hidden', 'true')
    })

    it('colours the badge by what the checks found', () => {
      mount()
      const tone = (card: HTMLElement, text: string): string | null | undefined =>
        within(card).getByText(text).closest('[data-pill]')?.getAttribute('data-tone')
      expect(tone(option(/Mossgate/), 'Valid')).toBe('ok')
      expect(tone(option(/draft\.note/), '1 warning')).toBe('warn')
      expect(tone(option(/torn\.af2d/), 'Can’t open')).toBe('bad')
    })

    it('draws the kind in the card’s accent, but leaves an undecided file’s candidates neutral', () => {
      mount()
      const kindPill = (card: HTMLElement, text: string): Element | null =>
        within(card).getByText(text).closest('[data-pill]')
      expect(kindPill(option(/Mossgate/), KIND)?.getAttribute('style')).toContain('--pill-color: var(--kind)')
      const undecided = kindPill(option(/stage\.toml/), `${KIND} or ${OTHER}`)
      expect(undecided).toHaveAttribute('data-tone', 'neutral')
      expect(undecided?.getAttribute('style') ?? '').not.toContain('--pill-color')
    })

    it('gives the whole path on hover, and no folder part for a file at the top', () => {
      mount()
      expect(within(option(/draft\.note/)).getByTitle('notes/draft.note')).toBeInTheDocument()
      expect(option(/Mossgate/).querySelector('.dir')).toBeNull()
      expect(option(/Mossgate/).querySelector('.file')).toHaveTextContent('mossgate.af2d.json')
    })

    it('takes its accent from the card, and the neutral one for a card without', () => {
      mount()
      expect(option(/Mossgate/).style.getPropertyValue('--kind')).toBe('var(--color-layer-tiles)')
      expect(option(/draft\.note/).style.getPropertyValue('--kind')).toBe('var(--color-layer-sky)')
      expect(option(/stage\.toml/).style.getPropertyValue('--kind')).toBe('var(--color-text-dim)')
    })
  })

  describe('choosing', () => {
    it('a click selects the card', async () => {
      const { onselect, onopen } = mount()
      await userEvent.click(option(/draft\.note/))
      expect(onselect).toHaveBeenCalledWith('notes/draft.note')
      expect(onopen).not.toHaveBeenCalled()
    })

    it('a click on a card puts focus on the listbox, so the keys work at once', async () => {
      mount()
      await userEvent.click(option(/draft\.note/))
      expect(list()).toHaveFocus()
    })

    it('a double click opens that card', async () => {
      const { onopen } = mount()
      await userEvent.dblClick(option(/draft\.note/))
      expect(onopen).toHaveBeenCalledWith('notes/draft.note')
    })

    it('a second mouse click on the selected card does not open it', async () => {
      const { onopen } = mount({ selected: 'notes/draft.note' })
      await userEvent.click(option(/draft\.note/))
      expect(onopen).not.toHaveBeenCalled()
    })

    it('a finger or pen selects on the first tap and opens on the second tap on the selected card', async () => {
      for (const pointerType of ['touch', 'pen']) {
        const { onselect, onopen, unmount } = mount()
        const card = option(/draft\.note/)
        await fireEvent.pointerDown(card, { pointerType })
        await fireEvent.click(card)
        expect(onselect).toHaveBeenCalledWith('notes/draft.note')
        expect(onopen).not.toHaveBeenCalled()
        unmount()

        const again = mount({ selected: 'notes/draft.note' })
        const selected = option(/draft\.note/)
        await fireEvent.pointerDown(selected, { pointerType })
        await fireEvent.click(selected)
        expect(again.onopen).toHaveBeenCalledWith('notes/draft.note')
        again.unmount()
      }
    })

    it('a click that no press on that card led to only selects, whatever happened to another card before', async () => {
      const { onselect, onopen } = mount({ selected: 'notes/draft.note' })
      // A finger touched the selected card to scroll and never clicked; later a click lands on another card.
      await fireEvent.pointerDown(option(/draft\.note/), { pointerType: 'touch' })
      await fireEvent.click(option(/stage\.toml/))
      expect(onselect).toHaveBeenCalledWith('stage.toml')
      expect(onopen).not.toHaveBeenCalled()
    })

    it('a press leads to one click only: the next click on the card is a plain select again', async () => {
      const { onselect, onopen } = mount({ selected: 'notes/draft.note' })
      const card = option(/draft\.note/)
      await fireEvent.pointerDown(card, { pointerType: 'touch' })
      await fireEvent.click(card)
      await fireEvent.click(card)
      expect(onopen).toHaveBeenCalledOnce()
      expect(onselect).toHaveBeenCalledOnce()
    })

    it('a tap on another card selects it even while one is selected', async () => {
      const { onselect, onopen } = mount({ selected: 'mossgate.af2d.json' })
      const card = option(/draft\.note/)
      await fireEvent.pointerDown(card, { pointerType: 'touch' })
      await fireEvent.click(card)
      expect(onselect).toHaveBeenCalledWith('notes/draft.note')
      expect(onopen).not.toHaveBeenCalled()
    })
  })

  describe('the keyboard', () => {
    it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const)(
      '%s moves the selection, without scrolling the page',
      async (key) => {
        const { onstep } = mount({ selected: 'notes/draft.note' })
        list().focus()
        const notPrevented = await fireEvent.keyDown(list(), { key })
        expect(onstep).toHaveBeenCalledWith(key)
        expect(notPrevented).toBe(false)
      },
    )

    it('Enter opens the selected project', async () => {
      const { onopen } = mount({ selected: 'notes/draft.note' })
      list().focus()
      await userEvent.keyboard('{Enter}')
      expect(onopen).toHaveBeenCalledWith('notes/draft.note')
    })

    it('Enter is taken, so a focused control around the list does not also act on it', async () => {
      mount({ selected: 'notes/draft.note' })
      list().focus()
      expect(await fireEvent.keyDown(list(), { key: 'Enter' })).toBe(false)
    })

    it('Enter with nothing selected opens nothing', async () => {
      const { onopen } = mount()
      list().focus()
      await userEvent.keyboard('{Enter}')
      expect(onopen).not.toHaveBeenCalled()
    })

    it('Delete asks to delete the selected project', async () => {
      const { ondelete } = mount({ selected: 'notes/draft.note' })
      list().focus()
      await userEvent.keyboard('{Delete}')
      expect(ondelete).toHaveBeenCalledOnce()
    })

    it.each([
      ['Alt+Left is the browser’s Back', { key: 'ArrowLeft', altKey: true }],
      ['Ctrl+Home belongs to the page', { key: 'Home', ctrlKey: true }],
      ['Cmd+Down belongs to the system', { key: 'ArrowDown', metaKey: true }],
      ['Ctrl+Enter is not Enter', { key: 'Enter', ctrlKey: true }],
      ['Alt+Delete is not Delete', { key: 'Delete', altKey: true }],
    ])('a key with a modifier is not the list’s: %s', async (_name, init) => {
      const { onstep, onopen, ondelete } = mount({ selected: 'notes/draft.note' })
      list().focus()
      expect(await fireEvent.keyDown(list(), init)).toBe(true)
      expect(onstep).not.toHaveBeenCalled()
      expect(onopen).not.toHaveBeenCalled()
      expect(ondelete).not.toHaveBeenCalled()
    })

    it('Delete is taken, and with nothing selected asks about nothing', async () => {
      const { ondelete } = mount({ selected: 'notes/draft.note' })
      list().focus()
      expect(await fireEvent.keyDown(list(), { key: 'Delete' })).toBe(false)
      expect(ondelete).toHaveBeenCalledOnce()
    })

    it('Delete is left alone when the editor offers no deleting', async () => {
      mount({ selected: 'notes/draft.note', ondelete: undefined })
      list().focus()
      expect(await fireEvent.keyDown(list(), { key: 'Delete' })).toBe(true)
    })

    it('Delete with nothing selected asks nothing', async () => {
      const { ondelete } = mount()
      list().focus()
      expect(await fireEvent.keyDown(list(), { key: 'Delete' })).toBe(true)
      expect(ondelete).not.toHaveBeenCalled()
    })

    it('other keys are left alone', async () => {
      const { onstep, onopen, ondelete } = mount({ selected: 'notes/draft.note' })
      list().focus()
      const notPrevented = await fireEvent.keyDown(list(), { key: 'a' })
      expect(notPrevented).toBe(true)
      expect(onstep).not.toHaveBeenCalled()
      expect(onopen).not.toHaveBeenCalled()
      expect(ondelete).not.toHaveBeenCalled()
    })

    it('keeps the selected card in view when the selection moves', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      const { rerender } = mount({ selected: 'mossgate.af2d.json' })
      await rerender({ selected: 'stage.toml' })
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' })
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(option(/stage\.toml/))
    })

    it('copes with a browser that has no scrollIntoView', async () => {
      const { rerender } = mount({ selected: 'mossgate.af2d.json' })
      await expect(rerender({ selected: 'stage.toml' })).resolves.not.toThrow()
    })
  })

  describe('when there is nothing to list', () => {
    it('shows a loading status, and no options, while the first listing is read', () => {
      mount({ loading: true, total: 0, visible: [] })
      expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument()
      expect(screen.queryByRole('option')).toBeNull()
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('says so when the workspace holds no project, with the editor’s hint on how to start one', () => {
      mount({ total: 0, visible: [] })
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
      expect(screen.getByText('Pick a template below to start one.')).toBeInTheDocument()
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('says what the search found nothing for, and Clear takes the search away', async () => {
      const { onclear } = mount({ visible: [], query: 'zzz' })
      expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(onclear).toHaveBeenCalledOnce()
    })
  })

  describe('previews (ED2D.4c3b)', () => {
    const KEY = `mossgate.af2d.json|4300|${NOW - 5 * 60_000}|assets/terrain.png@1700`
    const withPreview = (answer: string | undefined) => {
      const draw = vi.fn(async () => answer)
      return { draw, card: card('mossgate.af2d.json', { title: 'Mossgate', preview: { key: KEY, draw } }) }
    }

    it('draws a card’s preview in its tile once it is ready', async () => {
      const { draw, card: previewed } = withPreview('data:image/png;base64,AAAA')
      mount({ visible: [previewed, notes], total: 2 })
      const option_ = option(/Mossgate/)
      await vi.waitFor(() => expect(option_.querySelector('img')).not.toBeNull())
      const image = option_.querySelector('img')
      expect(image?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
      // Decorative: the card's title already names the project.
      expect(image?.getAttribute('alt')).toBe('')
      expect(within(option_).queryByText('M')).toBeNull()
      expect(draw).toHaveBeenCalledOnce()
    })

    it('keeps the initial for a card with no preview, or when none could be drawn', async () => {
      const { draw, card: previewed } = withPreview(undefined)
      mount({ visible: [previewed, notes], total: 2 })
      await vi.waitFor(() => expect(draw).toHaveBeenCalledOnce())
      expect(option(/Mossgate/).querySelector('img')).toBeNull()
      expect(within(option(/Mossgate/)).getByText('M')).toBeInTheDocument()
      expect(within(option(/draft\.note/)).getByText('D')).toBeInTheDocument()
    })

    it('draws again when the key changes, and not when the list is mapped again with the same key', async () => {
      const first = withPreview('data:image/png;base64,AAAA')
      const view = mount({ visible: [first.card], total: 1 })
      await vi.waitFor(() => expect(first.draw).toHaveBeenCalledOnce())
      const same = withPreview('data:image/png;base64,BBBB')
      await view.rerender({ visible: [same.card] })
      expect(same.draw).not.toHaveBeenCalled()
      const draw = vi.fn(async () => 'data:image/png;base64,CCCC')
      await view.rerender({
        visible: [card('mossgate.af2d.json', { title: 'Mossgate', preview: { key: `${KEY}+1`, draw } })],
      })
      await vi.waitFor(() =>
        expect(
          option(/Mossgate/)
            .querySelector('img')
            ?.getAttribute('src'),
        ).toBe('data:image/png;base64,CCCC'),
      )
      expect(draw).toHaveBeenCalledOnce()
    })
  })
})
