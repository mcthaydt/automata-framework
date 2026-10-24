import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { plantedProfile } from '../../testing/planted-profile'
import { createAppProfiles } from '../profiles'
import type { ProjectEntry } from '../project-list'
import ProjectList from './ProjectList.svelte'

// The listbox of projects (plan ED2D.4c2a, decision 3). The entries are written by hand so each state is exact; the
// registry is real, because a card takes its accent from the profile's place in it.

const NOW = 1_700_000_000_000
const registry = createAppProfiles()
registry.register(plantedProfile())
const [first, second] = registry.list().map((profile) => ({ id: profile.id, label: profile.label }))
if (first === undefined || second === undefined) throw new Error('the registry holds two profiles')

const ok = (path: string, over: Partial<Extract<ProjectEntry, { status: 'ok' }>> = {}): ProjectEntry => ({
  status: 'ok',
  path,
  size: 4300,
  mtime: NOW - 5 * 60_000,
  profile: first,
  errors: 0,
  warnings: 0,
  summary: undefined,
  ...over,
})
const mossgate = ok('mossgate.af2d.json', { summary: { title: 'Mossgate', facts: [] } })
const notes = ok('notes/draft.note', { profile: second, warnings: 1, size: 812 })
const broken: ProjectEntry = {
  status: 'broken',
  path: 'torn.af2d.json',
  size: 90,
  mtime: NOW - 3 * 3_600_000,
  profile: first,
  message: 'Not JSON',
}
const either: ProjectEntry = {
  status: 'ambiguous',
  path: 'stage.toml',
  size: 2048,
  mtime: NOW - 86_400_000 * 1.5,
  candidates: [first, second],
}

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
    registry,
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
    it('shows the profile’s title for the project, its kind, badge, file, size and age', () => {
      mount()
      const card = option(/Mossgate/)
      expect(card).toHaveTextContent('Mossgate')
      expect(card).toHaveTextContent(first.label)
      expect(card).toHaveTextContent('Valid')
      expect(card).toHaveTextContent('mossgate.af2d.json')
      expect(card).toHaveTextContent('4.2 KB')
      expect(card).toHaveTextContent('5 min ago')
    })

    it('falls back to the file name for a project whose profile gives no title, and keeps the folder apart', () => {
      mount()
      const card = option(/draft\.note/)
      expect(within(card).getByText('draft.note', { selector: '.file' })).toBeInTheDocument()
      expect(within(card).getByText('notes/', { selector: '.dir' })).toBeInTheDocument()
      expect(card).toHaveTextContent('1 warning')
      expect(card).toHaveTextContent('812 B')
    })

    it('says a broken file cannot be opened plainly, and an undecided one needs a profile', () => {
      mount()
      expect(option(/torn\.af2d\.json/)).toHaveTextContent('Can’t open')
      expect(option(/torn\.af2d\.json/)).toHaveTextContent('3 h ago')
      const undecided = option(/stage\.toml/)
      expect(undecided).toHaveTextContent('Choose a profile')
      expect(undecided).toHaveTextContent(`${first.label} or ${second.label}`)
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
      expect(kindPill(option(/Mossgate/), first.label)?.getAttribute('style')).toContain(
        '--pill-color: var(--kind)',
      )
      const undecided = kindPill(option(/stage\.toml/), `${first.label} or ${second.label}`)
      expect(undecided).toHaveAttribute('data-tone', 'neutral')
      expect(undecided?.getAttribute('style') ?? '').not.toContain('--pill-color')
    })

    it('gives the whole path on hover, and no folder part for a file at the top', () => {
      mount()
      expect(within(option(/draft\.note/)).getByTitle('notes/draft.note')).toBeInTheDocument()
      expect(option(/Mossgate/).querySelector('.dir')).toBeNull()
      expect(option(/Mossgate/).querySelector('.file')).toHaveTextContent('mossgate.af2d.json')
    })

    it('takes its accent from the place of its profile in the registry', () => {
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

    it('says so when the workspace holds no project, and points at the templates', () => {
      mount({ total: 0, visible: [] })
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
      expect(screen.getByText(/template/i)).toBeInTheDocument()
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('says what the search found nothing for, and Clear takes the search away', async () => {
      const { onclear } = mount({ visible: [], query: 'zzz' })
      expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(onclear).toHaveBeenCalledOnce()
    })
  })
})
