import { createToasts } from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../model/ids'
import { printProject } from '../../model/project-codec'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { noteText, plantedProfile } from '../../testing/planted-profile'
import { hollowmere, mossgate } from '../../testing/samples'
import { createTestClock } from '../../testing/test-clock'
import { createEditorApp, type EditorApp, type OpenOutcome } from '../editor-app'
import { createAppProfiles } from '../profiles'
import Home from './Home.svelte'
import { createHomeController } from './home-controller'
import { templateCards } from './home-model'

// Home as a person meets it (plan ED2D.4c2a step 6): the real app over a memory workspace, the real level project and a
// planted second profile, drawn inside the kit's shell with the geometry stand-in. The parts have their own tests; this
// one proves they are wired: what a click, a key or a file does to the list, the summary and the toasts.

type Opened = Extract<OpenOutcome, { status: 'opened' }>

interface Options {
  size?: [number, number]
  persistent?: boolean
  wrap?: (app: EditorApp) => EditorApp
  seed?: boolean
}

async function setup(options: Options = {}) {
  const { size = [1194, 834], persistent = true, wrap = (app) => app, seed = true } = options
  const clock = createTestClock()
  const workspace = { ...memoryWorkspace(clock), persistent }
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

const list = (): HTMLElement => screen.getByRole('listbox', { name: 'Projects' })
const option = (name: RegExp | string): HTMLElement => screen.getByRole('option', { name })
const search = (): HTMLInputElement => screen.getByRole('searchbox', { name: 'Search projects' })
const region = (name: string): HTMLElement => document.querySelector(`[data-region="${name}"]`) as HTMLElement
const optionNames = (): string[] =>
  within(list())
    .getAllByRole('option')
    .map((card) => card.querySelector('.title')?.textContent ?? '')

describe('Home', () => {
  describe('what it shows', () => {
    it('lists the projects newest first, with the first selected and described in the inspector', async () => {
      await setup()
      expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
      expect(screen.getByText('3 in this workspace')).toBeInTheDocument()
      expect(optionNames()).toEqual(['harbour.note', 'Hollowmere', 'Mossgate'])
      expect(option(/harbour\.note/)).toHaveAttribute('aria-selected', 'true')
      expect(within(region('inspector')).getByRole('heading', { name: 'harbour.note' })).toBeInTheDocument()
    })

    it('tells ages against the clock it is given', async () => {
      const { clock, controller } = await setup()
      clock.advance(5 * 60_000)
      await controller.refresh()
      await waitFor(() => expect(option(/Mossgate/)).toHaveTextContent('5 min ago'))
    })

    it('has the sources panel and no rail', async () => {
      await setup()
      const panel = region('panel')
      expect(within(panel).getByText('This workspace')).toBeInTheDocument()
      expect(within(panel).getByText('3 projects · browser storage')).toBeInTheDocument()
      expect(within(panel).getByLabelText('Import files…')).toBeInTheDocument()
      expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-rail', 'none')
    })

    it('offers a card for every template of every profile, naming the profile as there are two', async () => {
      const { registry } = await setup()
      const templates = screen.getByRole('region', { name: 'Start a new project' })
      const cards = within(templates).getAllByRole('button')
      expect(cards).toHaveLength(templateCards(registry).length)
      expect(within(templates).getAllByText('Planted note')).toHaveLength(2)
    })

    it('reads the workspace itself when it appears, so a return from a document shows what changed', async () => {
      const { write, props } = await setup()
      await write('late.af2d.json', printProject(mossgate()))
      expect(optionNames()).toHaveLength(3)
      cleanup()
      render(Home, props)
      await waitFor(() => expect(optionNames()).toHaveLength(4))
    })

    it('shows a loading skeleton until the first listing arrives', async () => {
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
      expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument()
      release()
      expect(await screen.findByText('No projects yet')).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: 'Loading projects' })).toBeNull()
    })

    it('invites a template when the workspace is empty, and the inspector asks for a selection', async () => {
      await setup({ seed: false })
      await waitFor(() => expect(screen.getByText('No projects yet')).toBeInTheDocument())
      expect(screen.getByText('Select a project')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Start a new project' })).toBeInTheDocument()
    })

    it('says in the status line when nothing is kept on the device', async () => {
      await setup({ persistent: false })
      expect(document.querySelector('[data-widget="status-line"]')).toHaveTextContent(
        'Not saved on this device',
      )
    })
  })

  describe('choosing a project', () => {
    it('a click selects it and shows it in the inspector', async () => {
      await setup()
      await userEvent.click(option(/Mossgate/))
      expect(option(/Mossgate/)).toHaveAttribute('aria-selected', 'true')
      expect(within(region('inspector')).getByRole('heading', { name: 'Mossgate' })).toBeInTheDocument()
      expect(list()).toHaveFocus()
    })

    it('the arrow keys, Home and End move the selection', async () => {
      await setup()
      list().focus()
      await userEvent.keyboard('{ArrowDown}')
      expect(option(/Hollowmere/)).toHaveAttribute('aria-selected', 'true')
      await userEvent.keyboard('{End}')
      expect(option(/Mossgate/)).toHaveAttribute('aria-selected', 'true')
      await userEvent.keyboard('{ArrowUp}{Home}')
      expect(option(/harbour\.note/)).toHaveAttribute('aria-selected', 'true')
    })

    it('Enter, a double click and the Open button each open the project', async () => {
      const { opened } = await setup()
      list().focus()
      await userEvent.keyboard('{ArrowDown}{Enter}')
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]?.document.path).toBe('hollowmere.af2d.json')

      await userEvent.dblClick(option(/Mossgate/))
      await waitFor(() => expect(opened).toHaveLength(2))
      expect(opened[1]?.document.path).toBe('mossgate.af2d.json')

      await userEvent.click(within(region('inspector')).getByRole('button', { name: 'Open' }))
      await waitFor(() => expect(opened).toHaveLength(3))
      expect(opened[2]?.document.path).toBe('mossgate.af2d.json')
    })
  })

  describe('opening by a double click alone', () => {
    it('opens the card it came on, not the one that happens to be selected', async () => {
      const { opened } = await setup()
      await fireEvent.dblClick(option(/Mossgate/))
      await waitFor(() => expect(opened).toHaveLength(1))
      expect(opened[0]?.document.path).toBe('mossgate.af2d.json')
    })
  })

  describe('searching', () => {
    it('narrows the list as you type and keeps the count honest', async () => {
      await setup()
      await userEvent.type(search(), 'moss')
      expect(optionNames()).toEqual(['Mossgate'])
      expect(screen.getByText('1 of 3 shown')).toBeInTheDocument()
    })

    it('says nothing matches, and Clear brings everything back', async () => {
      await setup()
      await userEvent.type(search(), 'zzz')
      expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(search()).toHaveValue('')
      expect(optionNames()).toHaveLength(3)
    })

    it('Escape clears a search that has text', async () => {
      await setup()
      await userEvent.type(search(), 'moss')
      await userEvent.keyboard('{Escape}')
      expect(search()).toHaveValue('')
      expect(optionNames()).toHaveLength(3)
    })
  })

  describe('making and changing projects', () => {
    it('a template makes a project and opens it', async () => {
      const { opened } = await setup({ seed: false })
      const templates = screen.getByRole('region', { name: 'Start a new project' })
      await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
      await waitFor(() => expect(opened).toHaveLength(1))
    })

    it('Duplicate adds the copy, selects it and says so', async () => {
      await setup()
      await userEvent.click(option(/Mossgate/))
      await userEvent.click(within(region('inspector')).getByRole('button', { name: 'Duplicate' }))
      expect(await screen.findByText('Copied to mossgate copy.af2d.json.')).toBeInTheDocument()
      expect(optionNames()).toHaveLength(4)
      expect(option(/mossgate copy/)).toHaveAttribute('aria-selected', 'true')
    })

    it('Delete asks first with Cancel focused, and Cancel keeps the project', async () => {
      await setup()
      await userEvent.click(option(/Mossgate/))
      await userEvent.click(within(region('inspector')).getByRole('button', { name: 'Delete' }))
      const dialog = screen.getByRole('dialog', { name: 'Delete mossgate.af2d.json?' })
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(optionNames()).toHaveLength(3)
    })

    it('Delete confirmed removes the project, says so and puts focus on the list', async () => {
      await setup()
      await userEvent.click(option(/Mossgate/))
      await userEvent.click(within(region('inspector')).getByRole('button', { name: 'Delete' }))
      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Deleted mossgate.af2d.json.')).toBeInTheDocument()
      await waitFor(() => expect(optionNames()).toEqual(['harbour.note', 'Hollowmere']))
      await waitFor(() => expect(list()).toHaveFocus())
    })

    it('the Delete key on the list asks about the selected project', async () => {
      await setup()
      list().focus()
      await userEvent.keyboard('{Delete}')
      expect(screen.getByRole('dialog', { name: 'Delete harbour.note?' })).toBeInTheDocument()
    })

    it('Import keeps the files a profile claims and names the ones it refuses', async () => {
      await setup({ seed: false })
      const brook = new File([printProject(mossgate())], 'brook.af2d.json')
      const stray = new File(['hello'], 'readme.txt')
      await userEvent.upload(screen.getByLabelText('Import files…'), [brook, stray])
      expect(await screen.findByText('Imported brook.af2d.json.')).toBeInTheDocument()
      expect(screen.getByText('readme.txt is not a project this editor opens.')).toBeInTheDocument()
      await waitFor(() => expect(optionNames()).toEqual(['Mossgate']))
    })
  })

  describe('while an action runs', () => {
    it('Import, the templates and the summary’s actions wait, and stay where they are', async () => {
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
      const templates = screen.getByRole('region', { name: 'Start a new project' })
      const first = within(templates).getAllByRole('button')[0] as HTMLElement
      await userEvent.click(first)
      await waitFor(() => expect(first).toBeDisabled())
      for (const card of within(templates).getAllByRole('button')) expect(card).toBeDisabled()
      expect(within(region('panel')).getByLabelText('Import files…')).toBeDisabled()
      for (const name of ['Open', 'Duplicate', 'Delete'])
        expect(within(region('inspector')).getByRole('button', { name })).toBeDisabled()
      release()
      await waitFor(() => expect(opened).toHaveLength(1))
      await waitFor(() => expect(first).toBeEnabled())
    })
  })

  describe('when the workspace cannot be read', () => {
    it('says so with the reason, keeps the sources and templates, and Retry recovers', async () => {
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
      expect(screen.getByRole('region', { name: 'Start a new project' })).toBeInTheDocument()
      expect(within(region('panel')).getByLabelText('Import files…')).toBeInTheDocument()

      failing = false
      await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
      expect(await screen.findByText('No projects yet')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('on a narrower screen', () => {
    it('keeps the panel and the inspector closed until asked, and a selection opens the inspector', async () => {
      await setup({ size: [834, 1194] })
      expect(region('panel')).toHaveAttribute('data-open', 'false')
      expect(region('inspector')).toHaveAttribute('data-open', 'false')
      await userEvent.click(option(/Mossgate/))
      expect(region('inspector')).toHaveAttribute('data-open', 'true')
    })

    it('a selection made where the inspector is always in view does not leave it open for the drawer after a rotation', async () => {
      const { geometry } = await setup()
      await userEvent.click(option(/Mossgate/))
      geometry.resize(834, 1194)
      flushSync()
      expect(region('inspector')).toHaveAttribute('data-open', 'false')
    })

    it('arrow keys do not open the inspector', async () => {
      await setup({ size: [834, 1194] })
      list().focus()
      await userEvent.keyboard('{ArrowDown}')
      expect(region('inspector')).toHaveAttribute('data-open', 'false')
    })

    it('a Sources button opens the panel, and Escape closes it', async () => {
      await setup({ size: [834, 1194] })
      const sources = screen.getByRole('button', { name: 'Sources' })
      expect(sources).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(sources)
      expect(region('panel')).toHaveAttribute('data-open', 'true')
      expect(sources).toHaveAttribute('aria-expanded', 'true')
      await userEvent.keyboard('{Escape}')
      expect(region('panel')).toHaveAttribute('data-open', 'false')
      await userEvent.click(sources)
      await userEvent.click(sources)
      expect(region('panel')).toHaveAttribute('data-open', 'false')
    })

    it('a Details button opens and closes the inspector', async () => {
      await setup({ size: [390, 844] })
      const details = screen.getByRole('button', { name: 'Details' })
      await userEvent.click(details)
      expect(region('inspector')).toHaveAttribute('data-open', 'true')
      expect(details).toHaveAttribute('aria-expanded', 'true')
      await userEvent.click(details)
      expect(region('inspector')).toHaveAttribute('data-open', 'false')
    })

    it('Escape clears the search before it closes a drawer', async () => {
      await setup({ size: [834, 1194] })
      await userEvent.click(screen.getByRole('button', { name: 'Details' }))
      await userEvent.type(search(), 'x')
      await userEvent.keyboard('{Escape}')
      expect(search()).toHaveValue('')
      expect(region('inspector')).toHaveAttribute('data-open', 'true')
      await userEvent.keyboard('{Escape}')
      expect(region('inspector')).toHaveAttribute('data-open', 'false')
    })

    it('an Escape that something else already took does not close a drawer', async () => {
      await setup({ size: [834, 1194] })
      await userEvent.click(screen.getByRole('button', { name: 'Details' }))
      const take = (event: KeyboardEvent): void => event.preventDefault()
      document.addEventListener('keydown', take)
      await userEvent.keyboard('{Escape}')
      document.removeEventListener('keydown', take)
      expect(region('inspector')).toHaveAttribute('data-open', 'true')
    })

    it('has no Sources button where the panel is always in view', async () => {
      await setup()
      expect(screen.queryByRole('button', { name: 'Sources' })).toBeNull()
    })

    it('rotating keeps the search text and the selection', async () => {
      const { geometry } = await setup()
      await userEvent.type(search(), 'o')
      await userEvent.click(option(/Mossgate/))
      geometry.resize(834, 1194)
      flushSync()
      expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
      expect(search()).toHaveValue('o')
      expect(option(/Mossgate/)).toHaveAttribute('aria-selected', 'true')
    })
  })
})
