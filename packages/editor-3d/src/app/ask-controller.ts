// The Ask as plain TypeScript (ED3D.10a, ED3D spec §5.3 flow 8): a prompt goes to the provider with the selection and a
// budget, the proposal is read into a copy of the level and shown as a ghost with its check results. No Svelte, DOM or
// clock in here; the provider is the suite's `AskProvider` port (editor-kit `./ports`, editor suite spec §4.3), and
// without one the Ask is off.
//
// A proposal is made for the level the person had when they asked, so it is only ever shown, and only ever accepted,
// over that level: an edit, an undo or a redo while it is on its way or on show drops it.
import type { AskProvider } from '@mcthaydt/automata-editor-kit/ports'
import type { CheckResult } from '../checks/check'
import { ok } from '../model/edit'
import type { LevelEditor } from '../model/level-editor'
import { type Geometry, GeometryError, type ProfileContext } from '../profile/level-profile'
import { problemCount } from './problem-count'

export interface AskOptions {
  /** The assistant; without one the editor has no Ask, which is not an error. */
  readonly provider?: AskProvider | undefined
  /** The tokens a proposal may use: it goes to the provider, and a proposal that used more is refused. */
  readonly budget: number
  /** The level's path in the workspace: the provider is told which file the proposal is for. */
  readonly path: string
  /** What the profile's checks may be told about the game that holds the level. */
  readonly context?: ProfileContext | undefined
}

/** The proposal, read into a copy of the level and checked. */
export interface AskGhost<D> {
  readonly summary: string
  readonly tokens: number
  readonly level: D
  /** What the profile draws for the copy; nothing when it cannot build it (the `expand` check says why). */
  readonly geometry: Geometry | undefined
  /** The sectors by id, in file order. */
  readonly sectors: {
    readonly added: readonly string[]
    readonly changed: readonly string[]
    readonly removed: readonly string[]
  }
  readonly checks: readonly CheckResult[]
  readonly errors: number
  readonly warnings: number
  /** False while the copy has check errors. */
  readonly canAccept: boolean
}

export interface AskView<D> {
  /** False without a provider: the panel has no Ask to show. */
  readonly available: boolean
  readonly status: 'idle' | 'asking' | 'ghost' | 'failed'
  /** The prompt of the request in flight, of the ghost or of the failure. */
  readonly prompt: string | undefined
  readonly ghost: AskGhost<D> | undefined
  /** Why a request ended with nothing to show (status `failed`). */
  readonly message: string | undefined
}

export type AcceptResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

export interface Ask<D> {
  readonly view: AskView<D>
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** Asks the provider; never rejects, a failure is the view's `failed` status. One request at a time. */
  ask(prompt: string): Promise<void>
  /**
   * Applies the ghost to the level as one undo step. Refused, with a sentence and nothing changed, while the ghost has
   * check errors, when there is no ghost, and while another step is open.
   */
  accept(): AcceptResult
  /** Drops the ghost or the failure, or stops waiting for a proposal; one that arrives later is ignored. */
  reject(): void
  /** Stops following the editor; a proposal that arrives later is ignored. */
  dispose(): void
}

const STALE = 'the level changed, so the proposal no longer applies; ask again'

/** Equal as data. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The first issue of a refused file, with the path of the member it is about. */
function firstIssue(
  issues: readonly { readonly path: readonly (string | number)[]; readonly message: string }[],
): string {
  return issues
    .slice(0, 1)
    .map(({ path, message }) => (path.length === 0 ? message : `${path.join('/')}: ${message}`))
    .join('')
}

export function createAsk<D>(editor: LevelEditor<D>, options: AskOptions): Ask<D> {
  const { provider } = options
  const listeners = new Set<() => void>()
  /** Moves on when a request is given up (rejected, or the Ask disposed): an answer from an earlier one is ignored. */
  let generation = 0
  let view: AskView<D> = {
    available: provider !== undefined,
    status: 'idle',
    prompt: undefined,
    ghost: undefined,
    message: undefined,
  }
  /** The ghost on show: the prompt it answers, and the level it was made for. */
  let shown: { readonly prompt: string; readonly level: D } | undefined
  /** True while Accept changes the level: that change is the ghost being applied, not the level moving under it. */
  let accepting = false

  const show = (next: Omit<AskView<D>, 'available'>): void => {
    view = { available: view.available, ...next }
    for (const run of [...listeners]) run()
  }

  const idle = (): Omit<AskView<D>, 'available'> => ({
    status: 'idle',
    prompt: undefined,
    ghost: undefined,
    message: undefined,
  })

  const fail = (prompt: string, message: string): void => {
    shown = undefined
    show({ status: 'failed', prompt, ghost: undefined, message })
  }

  /** The level the ghost was made for has been left behind by an edit, an undo, a redo or the first run of a drag. */
  const stop = editor.history.subscribe(() => {
    if (accepting || shown === undefined || shown.level === editor.level) return
    fail(shown.prompt, STALE)
  })

  /** The sectors the copy adds, changes and removes, by id. */
  function sectorsChanged(before: D, after: D): AskGhost<D>['sectors'] {
    const was = new Map(
      editor.profile.sectors.list(before).map((sector) => [sector.id, JSON.stringify(sector)]),
    )
    const now = editor.profile.sectors.list(after)
    const nowIds = new Set(now.map((sector) => sector.id))
    return {
      added: now.filter((sector) => !was.has(sector.id)).map((sector) => sector.id),
      changed: now
        .filter((sector) => was.has(sector.id) && was.get(sector.id) !== JSON.stringify(sector))
        .map((sector) => sector.id),
      removed: [...was.keys()].filter((id) => !nowIds.has(id)),
    }
  }

  function geometryOf(level: D): Geometry | undefined {
    try {
      return editor.profile.geometry(level)
    } catch (error) {
      if (error instanceof GeometryError) return undefined
      throw error
    }
  }

  /** The ghost for a proposal made over `before`, or the sentence that says why there is none. */
  function ghostOf(
    before: D,
    proposal: { readonly summary: string; readonly text: string; readonly tokens: number },
  ): AskGhost<D> | string {
    if (proposal.tokens > options.budget)
      return `the proposal used ${proposal.tokens} tokens, over the budget of ${options.budget}`
    const parsed = editor.profile.parse(proposal.text)
    if (!parsed.ok) return `the proposal is not a level this editor can read: ${firstIssue(parsed.issues)}`
    const level = parsed.value
    if (same(level, before)) return 'the proposal changes nothing'
    const checks = editor.profile.checks(level, options.context)
    const errors = problemCount(checks, 'error')
    return {
      summary: proposal.summary,
      tokens: proposal.tokens,
      level,
      geometry: geometryOf(level),
      sectors: sectorsChanged(before, level),
      checks,
      errors,
      warnings: problemCount(checks, 'warning'),
      canAccept: errors === 0,
    }
  }

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    async ask(prompt) {
      if (provider === undefined || view.status === 'asking') return
      const text = prompt.trim()
      if (text === '') return fail(text, 'say what you want changed')
      const mine = generation
      const before = editor.level
      const scope = [...editor.selection.ids]
      shown = undefined
      show({ status: 'asking', prompt: text, ghost: undefined, message: undefined })
      let proposal: Awaited<ReturnType<AskProvider['propose']>>
      try {
        proposal = await provider.propose({
          prompt: text,
          path: options.path,
          scope,
          budget: options.budget,
          document: JSON.stringify(before, null, 2),
        })
      } catch (error) {
        if (mine === generation)
          fail(text, `the assistant failed: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      if (mine !== generation) return
      if (editor.level !== before) return fail(text, STALE)
      const ghost = ghostOf(before, proposal)
      if (typeof ghost === 'string') return fail(text, ghost)
      shown = { prompt: text, level: before }
      show({ status: 'ghost', prompt: text, ghost, message: undefined })
    },
    accept() {
      const { ghost } = view
      if (ghost === undefined) return { ok: false, reason: 'there is no proposal to accept' }
      if (!ghost.canAccept) {
        const messages = ghost.checks.flatMap((each) =>
          each.severity === 'error' ? each.problems.map((problem) => problem.message) : [],
        )
        const plural = ghost.errors === 1 ? 'error' : 'errors'
        return {
          ok: false,
          reason: `the proposal leaves ${ghost.errors} check ${plural}: ${messages.slice(0, 1).join('')}`,
        }
      }
      accepting = true
      try {
        const applied = editor.run({
          id: 'ask.accept',
          label: `Ask: ${ghost.summary}`,
          run: () => ok(ghost.level),
        })
        if (!applied.ok) return { ok: false, reason: applied.reason }
      } finally {
        accepting = false
      }
      shown = undefined
      show(idle())
      return { ok: true }
    },
    reject() {
      generation++
      shown = undefined
      if (view.status !== 'idle') show(idle())
    },
    dispose() {
      generation++
      stop()
      listeners.clear()
    },
  }
}
