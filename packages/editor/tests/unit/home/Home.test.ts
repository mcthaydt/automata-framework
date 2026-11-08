// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import Home from '#src/features/home/Home.svelte'
import { createHomeController } from '#src/features/home/home-controller.ts'
import { templateCards } from '#src/features/home/home-model.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import {
  createEditorApp,
  type EditorApp,
  type OpenOutcome,
} from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'

// Home as a person meets it: the real app over a memory workspace, the real level project and a
// planted second profile, drawn inside the kit's shell with the geometry stand-in. The parts have their own tests; this
// one proves they are wired: what a tap, a key, a menu or a file does to the cards, the dialogs and the toasts. Every
// action the three-column Home had is reached here too (the plan's execution log lists them).

type Opened = Extract<OpenOutcome, { status: 'opened' }>

interface Options {
  size?: [number, number]
  persistent?: boolean
  /** A game folder served by `automata editor`, with the game's name. */
  game?: string
  wrap?: (app: EditorApp) => EditorApp
  seed?: boolean
}

async function setup(options: Options = {}) {
  const { size = [1194, 834], persistent = true, game, wrap = (app) => app, seed = true } = options
  const clock = createTestClock()
  const workspace = {
    ...memoryWorkspace(clock),
    persistent,
    ...(game === undefined ? {} : { served: true, game }),
  }
  const registry = createAppProfiles()
  registry.register(plantedProfile())
  const app = wrap(createEditorApp({ workspace, registry, ids: counterIds(), clock }))
  const toasts = createToasts({ clock })
  const opened: Opened[] = []
  const controller = createHomeController({
    app,
    toasts,
    onOpened: (outcome) => opened.push(outcome),
    onProblem: () => {},
  })
  const write = async (path: string, data: string): Promise<void> => {
    clock.advance(1000)
    await workspace.store.write(path, data)
  }
  if (seed) {
    await write('mossgate.af2d.json', printProject(mossgate()))
    await write('hollowmere.af2d.json', printProject(hollowmere()))
    await write('notes/harbour.note', noteText('harbour'))
    await controller.refresh()
  }
  const geometry = stubGeometry(...size)
  const props = { geometry, controller, workspace, registry, toasts, clock }
  render(Home, props)
  return { props, ...props, opened, write }
}

const levels = (): HTMLElement => screen.getByRole('list', { name: 'Levels' })
/** A card's open button: its name starts with the level's name ("More for …" does not). */
const card = (name: string): HTMLElement =>
  within(levels()).getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')}`) })
const cardNames = (): string[] =>
  [...levels().querySelectorAll('.open .title')].map((title) => title.textContent ?? '')
const search = (): HTMLInputElement => screen.getByRole('searchbox', { name: 'Search levels' })
const shell = (): HTMLElement => document.querySelector('[data-editor-shell]') as HTMLElement

async function choose(level: string, item: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: `More for ${level}` }))
  await userEvent.click(await screen.findByRole('menuitem', { name: item }))
}

describe('Home', () => {
  describe('what it shows', () => {
    it('lists the levels newest first in one column, the newest selected, with no side panels', async () => {
      await setup()
      expect(screen.getByRole('heading', { level: 1, name: 'Your levels' })).toBeInTheDocument()
      expect(cardNames()).toEqual(['harbour.note', 'Hollowmere', 'Mossgate'])
      expect(card('harbour.note')).toHaveAttribute('tabindex', '0')
      expect(card('Mossgate')).toHaveAttribute('tabindex', '-1')
      for (const region of ['panel', 'inspector', 'rail'])
        expect(shell()).toHaveAttribute(`data-${region}`, 'none')
    })

    it('has the Editor colours control at the foot', async () => {
      await setup()
      expect(screen.getByRole('radiogroup', { name: 'Editor colours' })).toBeInTheDocument()
    })

    it('says when each level changed, in words, against the clock it is given', async () => {
      const { clock, controller } = await setup()
      clock.advance(5 * 60_000)
      await controller.refresh()
      await waitFor(() => expect(card('Mossgate')).toHaveTextContent('Changed 5 minutes ago'))
    })

    it('shows no kind, size, path or "Valid" on a card', async () => {
      await setup()
      const text = levels().textContent ?? ''
      for (const word of ['Level project', 'Valid', '.af2d.json', 'KB']) expect(text).not.toContain(word)
    })

    it('names the game the levels come from, and says in one line how work is kept', async () => {
      await setup({ game: 'Emberwick' })
      expect(screen.getByTestId('home-source')).toHaveTextContent('Your game: Emberwick')
      expect(screen.getByRole('radio', { name: 'This game' })).toBeChecked()
      expect(screen.getByTestId('home-storage')).toHaveTextContent(
        'Saved in your game folder. Edits are kept if the page closes.',
      )
    })

    it('in a browser, names the browser once, in Open from; with nothing kept, says so', async () => {
      await setup()
      expect(screen.queryByTestId('home-source')).toBeNull()
      expect(screen.getByRole('radio', { name: 'This browser' })).toBeChecked()
      cleanup()
      await setup({ persistent: false })
      expect(screen.getByTestId('home-storage')).toHaveTextContent(
        'Not saved on this device. Download your level to keep it.',
      )
    })

    it('reads the workspace itself when it appears, so a return from a level shows what changed', async () => {
      const { write, props } = await setup()
      await write('late.af2d.json', printProject(mossgate()))
      expect(cardNames()).toHaveLength(3)
      cleanup()
      render(Home, props)
      await waitFor(() => expect(cardNames()).toHaveLength(4))
    })

    it('shows a loading placeholder until the first listing arrives', async () => {
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await setup({
        seed: false,
        wrap: (app) => ({
          ...app,
          list: async () => {
            await gate
            return app.list()
          },
        }),
      })
      expect(screen.getByRole('status', { name: 'Loading levels' })).toBeInTheDocument()
      release()
      expect(await screen.findByText('No levels yet')).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: 'Loading levels' })).toBeNull()
    })

    it('with no levels, points at the one New level button instead of offering a second', async () => {
      await setup({ seed: false })
      await waitFor(() => expect(screen.getByText('No levels yet')).toBeInTheDocument())
      expect(screen.queryByRole('searchbox')).toBeNull()
      const empty = screen.getByText('No levels yet').parentElement as HTMLElement
      // One button for one job: the top bar's New level is the primary, so the empty list only says where it is.
      expect(within(empty).queryByRole('button')).toBeNull()
      expect(within(empty).getByText(/New level/)).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'New level' })).toHaveLength(1)
      await userEvent.click(screen.getByRole('button', { name: 'New level' }))
      expect(screen.getByRole('dialog', { name: 'New level' })).toBeInTheDocument()
    })
  })

  describe('opening a level', () => {
    it('a tap on a card opens that level', async () => {
      const { opened } = await setup()
      await userEvent.click(card('Mossgate'))
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]?.document.path).toBe('mossgate.af2d.json')
    })

    it('the arrow keys, Home and End move the selection and the focus', async () => {
      await setup()
      card('harbour.note').focus()
      await userEvent.keyboard('{ArrowDown}')
      expect(card('Hollowmere')).toHaveFocus()
      expect(card('Hollowmere')).toHaveAttribute('tabindex', '0')
      await userEvent.keyboard('{End}')
      expect(card('Mossgate')).toHaveFocus()
      await userEvent.keyboard('{ArrowUp}{Home}')
      expect(card('harbour.note')).toHaveFocus()
    })

    it('Enter opens the card that has the focus, and so does Open in its menu', async () => {
      const { opened } = await setup()
      card('harbour.note').focus()
      await userEvent.keyboard('{ArrowDown}{Enter}')
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]?.document.path).toBe('hollowmere.af2d.json')
      await choose('Mossgate', 'Open')
      await waitFor(() => expect(opened).toHaveLength(2))
      expect(opened[1]?.document.path).toBe('mossgate.af2d.json')
    })
  })

  describe('searching', () => {
    it('narrows the cards as you type', async () => {
      await setup()
      await userEvent.type(search(), 'moss')
      expect(cardNames()).toEqual(['Mossgate'])
    })

    it('says nothing matches, and Clear brings everything back', async () => {
      await setup()
      await userEvent.type(search(), 'zzz')
      expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(search()).toHaveValue('')
      expect(cardNames()).toHaveLength(3)
    })

    it('Escape clears a search that has text', async () => {
      await setup()
      await userEvent.type(search(), 'moss')
      await userEvent.keyboard('{Escape}')
      expect(search()).toHaveValue('')
      expect(cardNames()).toHaveLength(3)
    })
  })

  describe('making and changing levels', () => {
    it('New level opens a sheet of every template, naming the profile as there are two', async () => {
      const { registry } = await setup()
      await userEvent.click(screen.getByTestId('new-level'))
      const sheet = screen.getByRole('dialog', { name: 'New level' })
      const templates = within(within(sheet).getByRole('list', { name: 'Templates' })).getAllByRole('button')
      expect(templates).toHaveLength(templateCards(registry).length)
      expect(
        within(sheet).getByRole('button', { name: /Platformer: jump between platforms|Platformer/ }),
      ).toBeInTheDocument()
      expect(within(sheet).getAllByText('Planted note')).toHaveLength(2)
    })

    it('on a game folder, offers no New level and no templates: those are the try-it page’s', async () => {
      await setup({ game: 'Emberwick' })
      expect(screen.queryByTestId('new-level')).toBeNull()
      cleanup()
      await setup({ game: 'Emberwick', seed: false })
      await waitFor(() => expect(screen.getByText('No levels yet')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'New level' })).toBeNull()
    })

    it('a template closes the sheet, makes the level and opens it', async () => {
      const { opened } = await setup({ seed: false })
      await userEvent.click(screen.getByTestId('new-level'))
      await userEvent.click(screen.getByRole('button', { name: /^Platformer/ }))
      expect(screen.queryByRole('dialog', { name: 'New level' })).toBeNull()
      await waitFor(() => expect(opened).toHaveLength(1))
    })

    it('Cancel closes the sheet and makes nothing', async () => {
      const { opened } = await setup()
      await userEvent.click(screen.getByTestId('new-level'))
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(opened).toHaveLength(0)
      expect(cardNames()).toHaveLength(3)
    })

    it('Duplicate adds the copy, selects it and says so', async () => {
      await setup()
      await choose('Mossgate', 'Duplicate')
      expect(await screen.findByText('Copied to mossgate copy.af2d.json.')).toBeInTheDocument()
      await waitFor(() => expect(cardNames()).toHaveLength(4))
      // The copy carries the level's own name, so it is told apart by its file.
      expect(levels().querySelector('[tabindex="0"]')).toHaveAttribute('data-path', 'mossgate copy.af2d.json')
    })

    it('Details shows what the level holds and its file', async () => {
      await setup()
      await choose('Mossgate', 'Details')
      const dialog = screen.getByRole('dialog', { name: 'Mossgate' })
      expect(within(dialog).getByText('mossgate.af2d.json')).toBeInTheDocument()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('Delete asks first, by the level’s name, with Cancel focused, and Cancel keeps it', async () => {
      await setup()
      await choose('Mossgate', 'Delete…')
      const dialog = screen.getByRole('dialog', { name: 'Delete Mossgate?' })
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(cardNames()).toHaveLength(3)
    })

    it('on a game folder, Delete says the level leaves the game', async () => {
      await setup({ game: 'Emberwick' })
      await choose('Mossgate', 'Delete…')
      expect(screen.getByRole('dialog')).toHaveTextContent('It’s removed from your game for good.')
    })

    it('Delete confirmed removes the level, says so by name and puts the focus on the next card', async () => {
      await setup()
      await choose('Mossgate', 'Delete…')
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete level' }))
      expect(await screen.findByText('Deleted Mossgate.')).toBeInTheDocument()
      await waitFor(() => expect(cardNames()).toEqual(['harbour.note', 'Hollowmere']))
      await waitFor(() => expect(card('Hollowmere')).toHaveFocus())
    })

    it('the Delete key on a card asks about that level', async () => {
      await setup()
      card('harbour.note').focus()
      await userEvent.keyboard('{ArrowDown}{Delete}')
      expect(screen.getByRole('dialog', { name: 'Delete Hollowmere?' })).toBeInTheDocument()
    })

    it('Import files keeps the files a profile claims, names the ones it refuses, and goes back to the list', async () => {
      await setup({ seed: false })
      await userEvent.click(screen.getByRole('radio', { name: 'Import files' }))
      const brook = new File([printProject(mossgate())], 'brook.af2d.json')
      const stray = new File(['hello'], 'readme.txt')
      await userEvent.upload(screen.getByLabelText('Choose files…'), [brook, stray])
      expect(await screen.findByText('Imported brook.af2d.json.')).toBeInTheDocument()
      expect(screen.getByText('readme.txt is not a project this editor opens.')).toBeInTheDocument()
      await waitFor(() => expect(cardNames()).toEqual(['Mossgate']))
      expect(screen.getByRole('radio', { name: 'This browser' })).toBeChecked()
    })
  })

  describe('while an action runs', () => {
    it('New level, the cards and their menus wait, and stay where they are', async () => {
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const { opened } = await setup({
        wrap: (app) => ({
          ...app,
          create: async (...args) => {
            await gate
            return app.create(...args)
          },
        }),
      })
      await userEvent.click(screen.getByTestId('new-level'))
      await userEvent.click(screen.getByRole('button', { name: /^Platformer/ }))
      await waitFor(() => expect(screen.getByTestId('new-level')).toBeDisabled())
      expect(card('Mossgate')).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByRole('button', { name: 'More for Mossgate' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      await userEvent.click(card('Mossgate'))
      release()
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]?.document.path).not.toBe('mossgate.af2d.json')
      await waitFor(() => expect(screen.getByTestId('new-level')).toBeEnabled())
    })
  })

  describe('when the workspace cannot be read', () => {
    it('says so with the reason, keeps New level, and Retry recovers', async () => {
      let failing = true
      await setup({
        seed: false,
        wrap: (app) => ({
          ...app,
          list: () => (failing ? Promise.reject(new Error('Storage is blocked.')) : app.list()),
        }),
      })
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Storage is blocked.')
      expect(screen.getByTestId('new-level')).toBeEnabled()
      failing = false
      await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
      expect(await screen.findByText('No levels yet')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('on any screen', () => {
    it('rotating keeps the search text and the selection', async () => {
      const { geometry } = await setup()
      await userEvent.type(search(), 'o')
      card('Mossgate').focus()
      geometry.resize(834, 1194)
      flushSync()
      expect(shell()).toHaveAttribute('data-mode', 'medium')
      expect(search()).toHaveValue('o')
      expect(card('Mossgate')).toHaveAttribute('tabindex', '0')
    })

    it('a phone shows the More menu as a sheet', async () => {
      await setup({ size: [390, 844] })
      await userEvent.click(screen.getByRole('button', { name: 'More for Mossgate' }))
      expect(await screen.findByRole('menu')).toBeInTheDocument()
    })
  })
})
