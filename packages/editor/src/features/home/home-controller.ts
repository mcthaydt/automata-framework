import {
  type BrowserState,
  createProjectBrowser,
  type ProjectListSource,
} from '../../shared/kit/home/project-browser.ts'
import type { ToastKind, ToastStore } from '../../shared/kit/widgets/toasts.ts'
import type {
  EditorApp,
  ImportOutcome,
  OpenOutcome,
  ProjectEntry,
} from '../../shared/level-2d/session/editor-app-types'
import {
  type ChoiceOutcome,
  needsPanel,
  type PanelOutcome,
} from '../../shared/level-2d/session/open-flow-model'
import { openProblem } from '../../shared/level-2d/session/open-problem'
import { duplicateMessage, importNotices, removeMessage, searchWords } from './home-model'

// The 2D editor's Home (plan ED2D.4c2a, decision 1): the kit's project browser (the list, the search, the selection and
// one action at a time) with this editor's actions on top: open, create from a template, duplicate, delete and import.
// It never navigates and draws nothing: when a document opens it tells its owner, and every outcome a person should
// hear about goes to the toast store.

export type Busy = 'open' | 'create' | 'duplicate' | 'remove' | 'import'

export type HomeState = BrowserState<ProjectEntry, Busy>

export interface HomeController extends ProjectListSource<ProjectEntry, Busy> {
  /** Opens `path`, or the selected project; `as` is the profile the person chose for a file two profiles claim. */
  open(path?: string, as?: string): Promise<void>
  create(profileId: string, templateId: string): Promise<void>
  /** Copies the selected project and selects the copy. */
  duplicate(): Promise<void>
  /** Deletes the selected project and moves the selection to its neighbour. */
  remove(): Promise<void>
  importFiles(files: readonly { readonly name: string; readonly bytes: Uint8Array }[]): Promise<void>
}

/** Where the project opened last is kept between visits: Home selects it again (ED2D.8). A store that cannot keep it is no store. */
export interface LastOpened {
  read(): string | undefined
  write(path: string): void
}

export interface HomeControllerOptions {
  readonly app: EditorApp
  readonly toasts: ToastStore
  /** The project opened last time; absent, Home selects the newest as it always did. */
  readonly lastOpened?: LastOpened
  /** A document opened (from Open or from New): the owner takes the person to it. */
  onOpened(opened: Extract<OpenOutcome, { readonly status: 'opened' }>): void
  /** A file that needs looking at (the error panel) or a choice of profile: the owner shows it over Home. */
  onProblem(outcome: PanelOutcome | ChoiceOutcome): void
}

export function createHomeController(options: HomeControllerOptions): HomeController {
  const { app, toasts, lastOpened, onOpened, onProblem } = options
  const say = (kind: ToastKind, message: string): void => {
    toasts.push({ kind, message })
  }
  const browser = createProjectBrowser<ProjectEntry, Busy>({
    list: () => app.list(),
    words: searchWords,
    onError: (message) => say('error', message),
  })
  /** The first listing selects the project opened last time when it is still there; later ones keep the person's choice. */
  let firstListing = true
  const refresh = (): Promise<void> => {
    if (!firstListing) return browser.refresh()
    firstListing = false
    const last = lastOpened?.read()
    return browser.load(last === undefined ? undefined : (visible) => listedPath(last)(visible))
  }
  const listedPath =
    (path: string | undefined) =>
    (visible: readonly ProjectEntry[]): string | undefined =>
      path !== undefined && visible.some((entry) => entry.path === path) ? path : undefined

  /**
   * A document opens and its owner takes over. A file to look at or to choose a profile for goes to the owner too (plan
   * ED2D.4c2b, decision 1); a missing file or a store that refused is a toast. Either way the list is read again.
   */
  async function settleOpen(outcome: OpenOutcome): Promise<void> {
    if (outcome.status === 'opened') {
      lastOpened?.write(outcome.document.path)
      onOpened(outcome)
      return
    }
    if (needsPanel(outcome) || outcome.status === 'choose') onProblem(outcome)
    else say('error', openProblem(outcome))
    await browser.load()
  }

  return {
    state: browser.state,
    refresh,
    search: browser.search,
    select: browser.select,
    step: browser.step,
    async open(path, as) {
      const target = path ?? browser.current.selected
      if (target === undefined) return
      await browser.run('open', async () => {
        browser.select(target)
        await settleOpen(await app.open(target, as))
      })
    },
    create: (profileId, templateId) =>
      browser.run('create', async () => settleOpen(await app.create(profileId, templateId))),
    async duplicate() {
      const target = browser.current.selected
      if (target === undefined) return
      await browser.run('duplicate', async () => {
        const outcome = await app.duplicate(target)
        const notice = duplicateMessage(target, outcome)
        say(notice.kind, notice.text)
        await browser.load(listedPath(outcome.status === 'copied' ? outcome.path : undefined))
      })
    },
    async remove() {
      const target = browser.current.selected
      if (target === undefined) return
      const at = browser.current.visible.findIndex((entry) => entry.path === target)
      await browser.run('remove', async () => {
        await app.remove(target)
        const notice = removeMessage(target)
        say(notice.kind, notice.text)
        await browser.load((visible) => visible[Math.min(at, visible.length - 1)]?.path)
      })
    },
    async importFiles(files) {
      if (files.length === 0) return
      await browser.run('import', async () => {
        const outcomes: ImportOutcome[] = []
        for (const file of files) outcomes.push(await app.importFile(file.name, file.bytes))
        for (const notice of importNotices(outcomes)) say(notice.kind, notice.text)
        const kept = outcomes.findLast((outcome) => outcome.status === 'imported')
        await browser.load(listedPath(kept?.status === 'imported' ? kept.path : undefined))
      })
    },
  }
}
