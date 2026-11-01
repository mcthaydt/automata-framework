import { createHistory, type History } from '@mcthaydt/automata-editor-kit/core'
import { type ContentEdit, openDocument } from '@mcthaydt/automata-editor-kit/documents'
import type { SuitePorts, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { kindOf, readStudioContent, readValue, type StudioContent } from './studio-content'

// The Studio's session (EDS.9a; editor suite spec §4.4, §6.2, EDS-D12): the figure content of one game, kept for the
// app's life. One kit `History` holds the text of every file, so an edit, a new file and their Undo are all steps of
// one list. An edit is a span-preserving change of one literal (the kit's content documents) that the figures schemas
// must still accept; it is written through the workspace port before it counts (the port's rules, the mtime guard and
// the change set's journal stay the port's), and Undo and Redo write the files back. A write the port refuses is a
// message naming the file, and the history is left as it was.

export interface StudioState {
  /** The text of every file the Studio has, by path. A file that is not there has no entry. */
  readonly texts: Readonly<Record<string, string>>
}

export type StudioOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

export interface StudioSession {
  readonly history: History<StudioState>
  /** The content of the files as they are now (parsed once per state). */
  content(): StudioContent
  /** One change of one file's literals, as one undo step. */
  edit(path: string, edits: readonly ContentEdit[], label: string): Promise<StudioOutcome>
  /** A new file, as one undo step; refused when the path exists, is not writable, or fails its schema. */
  create(path: string, text: string, label: string): Promise<StudioOutcome>
  undo(): Promise<StudioOutcome>
  redo(): Promise<StudioOutcome>
}

const OK: StudioOutcome = { ok: true }
const refused = (message: string): StudioOutcome => ({ ok: false, message })

export async function openStudio(ports: SuitePorts): Promise<StudioSession> {
  const { workspace } = ports
  const listed: WorkspaceFile[] = await workspace.files('studio')
  const writable = new Map(listed.map((file) => [file.path, file] as const))
  const texts: Record<string, string> = {}
  const mtimes = new Map<string, number>()
  for (const file of listed) {
    if (kindOf(file.path) === undefined) continue
    const read = await workspace.read(file.path)
    if (read === undefined) continue
    texts[file.path] = read.text
    mtimes.set(file.path, read.mtime)
  }
  const history = createHistory<StudioState>({ texts })

  let cached: { readonly state: StudioState; readonly content: StudioContent } | undefined
  const content = (): StudioContent => {
    if (cached?.state !== history.state)
      cached = {
        state: history.state,
        content: readStudioContent(
          Object.entries(history.state.texts).map(([path, text]) => ({ path, text })),
        ),
      }
    return cached.content
  }

  /**
   * Why a listed file cannot be written, or `undefined`. A path that is not listed yet (a new file) is the port's to
   * judge: its editor list decides whether a row matches it.
   */
  const unwritable = (path: string): string | undefined => {
    const file = writable.get(path)
    return file === undefined || file.writable ? undefined : `${path}: ${file.why ?? 'it is read only'}`
  }

  /** Writes `to`'s differences from `from` through the port; stops at the first refusal. */
  async function sync(from: StudioState, to: StudioState): Promise<StudioOutcome> {
    const paths = [...new Set([...Object.keys(from.texts), ...Object.keys(to.texts)])].sort()
    for (const path of paths) {
      const was = from.texts[path]
      const now = to.texts[path]
      if (was === now) continue
      const known = mtimes.get(path)
      if (now === undefined) {
        const result = await workspace.remove(path, { mtime: known ?? 0 })
        if (!result.ok) return refused(`${path}: ${result.message}`)
        mtimes.delete(path)
        continue
      }
      const result = await workspace.write(
        path,
        now,
        was === undefined || known === undefined ? 'absent' : { mtime: known },
      )
      if (!result.ok) return refused(`${path}: ${result.message}`)
      mtimes.set(path, result.mtime)
    }
    return OK
  }

  async function commit(label: string, next: StudioState): Promise<StudioOutcome> {
    const written = await sync(history.state, next)
    if (!written.ok) return written
    history.apply(label, () => next)
    return OK
  }

  /** Undo or redo: the step is taken, the files follow, and a refused write takes the step back. */
  async function travel(back: boolean): Promise<StudioOutcome> {
    const before = history.state
    if (back) history.undo()
    else history.redo()
    const written = await sync(before, history.state)
    if (written.ok) return OK
    if (back) history.redo()
    else history.undo()
    return written
  }

  return {
    history,
    content,
    async edit(path, edits, label) {
      const problem = unwritable(path)
      if (problem !== undefined) return refused(problem)
      const text = history.state.texts[path]
      const kind = kindOf(path)
      if (text === undefined || kind === undefined) return refused(`${path}: there is no such file`)
      let result: ReturnType<ReturnType<typeof openDocument>['edit']>
      try {
        result = openDocument(path, text).edit(edits)
      } catch (error) {
        // The patcher throws for a few shapes it cannot place; that is a refusal of the edit, not a crash of the editor.
        return refused(
          `${path}: the document could not make this edit (${error instanceof Error ? error.message : String(error)})`,
        )
      }
      if (!result.ok) return refused(`${path}: ${result.message}`)
      const read = readValue(kind, result.document.text)
      if ('problem' in read) return refused(`${path}: ${read.problem}`)
      return commit(label, { texts: { ...history.state.texts, [path]: result.document.text } })
    },
    async create(path, text, label) {
      const problem = unwritable(path)
      if (problem !== undefined) return refused(problem)
      const kind = kindOf(path)
      if (kind === undefined) return refused(`${path}: the Studio has no content kind for this path`)
      if (path in history.state.texts) return refused(`${path}: a file with that name already exists`)
      const read = readValue(kind, text)
      if ('problem' in read) return refused(`${path}: ${read.problem}`)
      return commit(label, { texts: { ...history.state.texts, [path]: text } })
    },
    undo: () => travel(true),
    redo: () => travel(false),
  }
}
