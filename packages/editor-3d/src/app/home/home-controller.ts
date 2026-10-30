// The 3D editor's Home (plan ED3D.5c, decisions 2 and 3): the kit's project browser (the list, the search, the selection
// and one action at a time) with this editor's actions on top: open a level, import a folder, import a zip. It never
// navigates and draws nothing: an opened level goes to its owner, a file to look at goes to the owner's error panel,
// and everything else a person should hear about is a toast.
import {
  createProjectBrowser,
  type ProjectListSource,
  type ToastStore,
} from '@mcthaydt/automata-editor-kit/core'
import { needsPanel, type PanelOutcome } from '../document/open-flow-model'
import type { EditorApp, OpenOutcome } from '../editor-app'
import type { ImportOutcome, PickedFile } from '../import-files'
import type { ProjectEntry } from '../project-list'
import { importNotice, openProblem, searchWords } from './home-model'

export type Busy = 'open' | 'import'

export interface HomeController extends ProjectListSource<ProjectEntry, Busy> {
  /** Opens `path`, or the selected entry. */
  open(path?: string): Promise<void>
  /** A picked folder's files, each with its path from the folder's name down. */
  importFolder(files: readonly PickedFile[]): Promise<void>
  importZip(file: { readonly name: string; readonly bytes: Uint8Array }): Promise<void>
}

export interface HomeControllerOptions {
  readonly app: EditorApp
  readonly toasts: ToastStore
  /** A level opened: the owner takes the person to it. */
  onOpened(opened: Extract<OpenOutcome, { readonly status: 'opened' }>): void
  /** A file that does not open: the owner shows the error panel over Home. */
  onProblem(outcome: PanelOutcome): void
}

export function createHomeController(options: HomeControllerOptions): HomeController {
  const { app, toasts, onOpened, onProblem } = options
  const browser = createProjectBrowser<ProjectEntry, Busy>({
    list: () => app.list(),
    words: searchWords,
    onError: (message) => toasts.push({ kind: 'error', message }),
  })

  /** Says how an import went and selects the first file it brought in that the list shows. */
  async function settleImport(outcome: ImportOutcome): Promise<void> {
    const notice = importNotice(outcome)
    toasts.push({ kind: notice.kind, message: notice.text })
    const root = outcome.status === 'refused' ? undefined : `${outcome.root}/`
    await browser.load((visible) =>
      root === undefined ? undefined : visible.find((entry) => entry.path.startsWith(root))?.path,
    )
  }

  return {
    state: browser.state,
    refresh: browser.refresh,
    search: browser.search,
    select: browser.select,
    step: browser.step,
    async open(path) {
      const target = path ?? browser.current.selected
      if (target === undefined) return
      await browser.run('open', async () => {
        browser.select(target)
        const outcome = await app.open(target)
        if (outcome.status === 'opened') {
          onOpened(outcome)
          return
        }
        if (needsPanel(outcome)) onProblem(outcome)
        else
          toasts.push({
            kind: 'error',
            message: openProblem(
              outcome.status === 'storageFailed' ? outcome : { status: 'missing', path: outcome.path },
            ),
          })
        await browser.load()
      })
    },
    async importFolder(files) {
      if (files.length === 0) return
      await browser.run('import', async () => settleImport(await app.importFolder(files)))
    },
    importZip: (file) =>
      browser.run('import', async () => settleImport(await app.importZip(file.name, file.bytes))),
  }
}
