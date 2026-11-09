<!--
  The suite: one kit `EditorShell` around Home, the nine-entry switcher and the
  editor an entry opens. An entry that exactly one installed editor covers opens it: `open` runs once per entry for
  the app's life, so the editor's session (documents, history, selection, view state) outlives a switch (EDS-D12),
  and its regions fill the shell's. Any other entry shows its cards. The shell stays mounted through every switch and
  rotation; only what is inside its regions changes. Home is `SuiteHome`, Publish on a game's own folder is
  `PublishGameDialog`, Undo and Redo are `suite-history`, and what a refused write says is
  `core/write-messages` (split by responsibility in 12.7 and 12.5).
-->
<script lang="ts">
import type { GeometryState } from '@automata/framework'
import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor'
import type { CheckFinding, SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import EditorShell from '../../../shared/kit/shell/EditorShell.svelte'
import { defaultDockOpen, dockPlacementOf, shellModeAt } from '../../../shared/kit/shell/shell-mode'
import { keepStorage } from '../../../shared/kit/storage/keep-storage'
import { guardLeaving } from '../../../shared/kit/storage/leave-guard'
import { flushOnHide } from '../../../shared/kit/storage/page-lifecycle'
import type { GamePublish } from '../../../shared/kit/storage/publish-client'
import type { Where } from '../../../shared/kit/storage/save-line'
import { saveLine } from '../../../shared/kit/storage/save-line'
import {
  browserDraftStorage,
  createTypingDrafts,
  pageTimers,
} from '../../../shared/kit/storage/typing-drafts'
import type { Choice, MergeAsk } from '../../../shared/kit/sync/git-engine'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import ToastRegion from '../../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../../shared/kit/widgets/toasts'
import { setTypingDrafts } from '../../../shared/kit/widgets/typing-context'
import { type Pill, pillsToShow } from '../core/pills-model'
import { findingMessage, refusalMessage } from '../core/write-messages'
import type { SuiteSync } from './boot'
import type { Suite } from './create-suite'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'
import PublishGameDialog from './PublishGameDialog.svelte'
import ReadOnlyFile from './ReadOnlyFile.svelte'
import SuiteHome from './SuiteHome.svelte'
import SuiteRail from './SuiteRail.svelte'
import SuiteTopBar from './SuiteTopBar.svelte'
import SyncConflictDialog from './SyncConflictDialog.svelte'
import { suiteEntries } from './suite-entries'
import { suiteHistory } from './suite-history.svelte'
import { createSuiteSession } from './suite-session'

interface Props {
  geometry: GeometryState
  home: HomeState
  suite: Suite
  ports: SuitePorts
  sample: boolean
  /** Whether the sample is kept in this browser; false says its changes are lost with the page. */
  kept?: boolean
  /** The game's name in words, from the server or the person's own list of games; the title. */
  game?: string | undefined
  /** Which game this is, so two games' unsaved words never meet; the name when there is none. */
  gameKey?: string | undefined
  /** Where the files live, when the page knows better than "sample or folder" (the person's games in this browser). */
  where?: Where | undefined
  /** The editor to open on, when the person left one open last time and it is still there. */
  initialEditor?: string | undefined
  /** Tells the page which editor is open (undefined is Home), so it can open there next time. */
  onEditor?: ((id: string | undefined) => void) | undefined
  /** The running game's page, from the server: Play opens it. */
  playUrl?: string | undefined
  /** Why Play is off (the game could not start), from the server: Play says it when pressed. */
  playOff?: string | undefined
  /** Builds the game into a zip to upload, on a game's own folder: Publish opens it. */
  publish?: GamePublish | undefined
  /** Reads Home again (on each return to it); without it, Home stays as it was given. */
  reread?: (() => Promise<HomeState>) | undefined
  /** The game is kept on GitHub: the saved line takes its words, and a pull opens the editors again from the files. */
  sync?: SuiteSync | undefined
}

const {
  geometry,
  home: given,
  suite,
  ports,
  sample,
  kept = true,
  game,
  gameKey,
  where,
  initialEditor,
  onEditor,
  playUrl,
  playOff,
  publish,
  reread,
  sync,
}: Props = $props()
let latest = $state<HomeState>()
const home = $derived(latest ?? given)

// svelte-ignore state_referenced_locally
const startOn =
  initialEditor !== undefined &&
  suiteEntries(
    suite.editors,
    given.kind === 'cards' ? given.cards.map((card) => card.editor) : undefined,
  ).some((candidate) => candidate.id === initialEditor)
    ? initialEditor
    : undefined
let current = $state<string | undefined>(startOn)
let reading = $state<WorkspaceFile | undefined>()
let panelOpen = $state(false)
let inspectorOpen = $state(false)
/** `undefined` follows the shell's default for the size. */
let dockOpen = $state<boolean | undefined>()
let sessions = $state.raw<Readonly<Record<string, unknown>>>({})
const opening = new Set<string>()

const mode = $derived(shellModeAt(geometry.current))
// Where the dock is a sheet (below `wide`, or short), the top bar opens and closes it, as Panel and Details do theirs.
const dockIsSheet = $derived(dockPlacementOf(mode, geometry.current.heightTier) !== 'inline')
const dockShown = $derived(dockOpen ?? defaultDockOpen(mode, geometry.current.heightTier))
// The rail: every editor this page registered, less those for a kind the game is not. The list says which kind(s) the
// game is; an editor it does not name still shows and opens on its start page.
const entries = $derived(
  suiteEntries(suite.editors, home.kind === 'cards' ? home.cards.map((card) => card.editor) : undefined),
)
const entry = $derived(entries.find((candidate) => candidate.id === current))
// A phone held upright has no width for the saved line beside the game's name and the tools: it takes a row under them,
// whole, so "Not on GitHub yet" is never cut away.
const lineBelow = $derived(mode === 'compact' && geometry.current.layout.width < 600)
// A phone held sideways has no height to spare for a tab bar: the editors fold into a menu in the top bar, so the stage
// keeps the height (V4).
const folded = $derived(mode === 'compact' && geometry.current.heightTier === 'short')
const editorMenu = $derived(
  entries.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    ...(candidate.id === current ? { detail: 'Open now' } : {}),
  })),
)

// The installed editor the chosen entry opens: the card whose entry it is. An editor with two entries has two cards,
// which open the same editor (and its one session) at different views.
const target = $derived.by((): { editor: SuiteEditor<unknown>; card: EditorCard } | undefined => {
  if (entry === undefined || home.kind !== 'cards') return undefined
  const card = home.cards.find((candidate) => candidate.installed && candidate.entry === entry.id)
  const editor = card === undefined ? undefined : suite.editor(card.editor)
  return card === undefined || editor === undefined ? undefined : { editor, card }
})
const mounted = $derived(
  target !== undefined && reading === undefined && target.editor.id in sessions
    ? { editor: target.editor, session: sessions[target.editor.id] }
    : undefined,
)

/** Opens `editor` on its files into a session; one already opening is left to finish. */
function openEditor(editor: SuiteEditor<unknown>, card: EditorCard): void {
  if (opening.has(editor.id)) return
  opening.add(editor.id)
  const asked = entry?.view
  void editor.open(card.files, editing.portsFor(editor.id)).then(
    (session) => {
      // The view of the entry now chosen if it is still this editor's, else the one that asked: the right view draws
      // first, and an effect would paint the old one for a frame.
      const now = entries.find((candidate) => candidate.id === current)
      showView(editor, session, now?.editors[0] === editor.id ? now.view : asked)
      sessions = { ...sessions, [editor.id]: session }
      opening.delete(editor.id)
    },
    () => opening.delete(editor.id),
  )
}

$effect(() => {
  if (target === undefined) return
  const { editor, card } = target
  if (editor.id in sessions) return
  openEditor(editor, card)
})

// Editing (flows 3 to 8): every editor is opened with ports whose writes take the suite's write path; the pills and
// Undo follow it. The session lives as long as the suite.
// Typed words are written as they are typed (P14): every field of every editor registers here, and the registry keeps
// the words in the browser's own storage until the write has landed, so a page that goes away inside the half second
// gets them back.
// svelte-ignore state_referenced_locally
const drafts = createTypingDrafts({
  timers: pageTimers,
  drafts: browserDraftStorage(),
  scope: gameKey ?? game ?? 'sample',
})
setTypingDrafts(drafts)
// svelte-ignore state_referenced_locally
const keep = keepStorage()
const editing = $derived(createSuiteSession(ports, { drafts, keep }))

// The saved line: fields holding typed text plus writes in flight, what a store last refused, and where the files live.
let pending = $state(0)
let failed = $state<string | undefined>()
$effect(() => {
  const session = editing
  const read = () => {
    pending = drafts.waiting + session.inFlight
    failed = session.failed
    showPulled()
    if (!typing()) sync?.retry()
  }
  const stopSession = session.subscribe(read)
  const stopDrafts = drafts.subscribe(read)
  read()
  return () => {
    stopSession()
    stopDrafts()
  }
})
// A game kept on GitHub: what the sync last said takes the place of "Saved on this device".
let synced = $state<{ line: string } | undefined>()
$effect(() => {
  if (sync === undefined) return
  synced = sync.status.get()
  return sync.status.subscribe((status) => (synced = status))
})

// Files that changed here and on GitHub wait for the person's choice. The dialog opens once no word waits to be written
// (never over a word being typed), "Not now" puts it away, and the top bar's line, a button while files wait, brings it back.
let conflicts = $state<readonly MergeAsk[]>([])
let putAway = $state(false)
let choosing = $state(false)
let choiceFailed = $state(false)
let read = 0
async function readConflicts(): Promise<void> {
  const mine = ++read
  const waiting = sync === undefined || sync.status.get().state !== 'conflict' ? [] : await sync.conflicts()
  if (mine !== read) return
  conflicts = waiting
  if (waiting.length === 0) putAway = false
}
$effect(() => {
  if (sync === undefined) return
  void readConflicts()
  return sync.status.subscribe(() => void readConflicts())
})
async function chooseConflict(path: string, choice: Choice): Promise<void> {
  if (sync === undefined) return
  choosing = true
  choiceFailed = false
  choiceFailed = !(await sync.resolve(path, choice))
  choosing = false
  await readConflicts()
}
const line = $derived(
  saveLine({
    pending,
    failed,
    where: where ?? (sample ? (kept ? 'device' : 'nowhere') : 'folder'),
    sync: synced,
  }),
)

// A pull wrote files an editor may hold. Once no word waits and no write runs, every editor is opened again from the
// files (a write from an editor that still held the old text was refused, not laid over the new), and Home is read again.
// The sync does not pull while the person is typing (the last key more than 3 seconds ago), so no key is lost.
let pulledPaths: readonly string[] = []
let stale = false
const typing = () => drafts.typing || editing.inFlight > 0
function showPulled(): void {
  if (!stale || typing()) return
  // A field the person is still in, but has stopped typing in, is left first, here and not while the editor is taken
  // down: leaving a field writes its words, which cannot happen in the middle of removing it. Leaving can itself bring
  // us back here.
  const focused = document.activeElement
  if (focused instanceof HTMLElement && focused !== document.body) focused.blur()
  if (!stale || typing()) return
  stale = false
  // What the sync wrote is the file now: the write path judges the next edit against it, not against its own last write.
  editing.writePath.forget(pulledPaths)
  pulledPaths = []
  // The open editor stays on screen until its new session is ready; the others open again when they are chosen.
  const open = target
  sessions =
    open !== undefined && open.editor.id in sessions ? { [open.editor.id]: sessions[open.editor.id] } : {}
  if (open !== undefined) openEditor(open.editor, open.card)
  void reread?.().then((read) => (latest = read))
}
$effect(() => {
  if (sync === undefined) return
  const stopHolding = sync.holdWhile(typing)
  const stopPulled = sync.onPulled((paths) => {
    pulledPaths = [...pulledPaths, ...paths]
    stale = true
    showPulled()
  })
  return () => {
    stopHolding()
    stopPulled()
  }
})
const toasts = createToasts()
let pills = $state<readonly Pill[]>([])
// Icons with counts in the `short` tier and on a phone, where full labels leave no room; never hidden.
const compact = $derived(geometry.current.heightTier === 'short' || mode === 'compact')

$effect(() => {
  const session = editing
  const read = () => {
    pills = session.pills()
  }
  const stop = session.subscribe(read)
  read()
  void session.refresh()
  return stop
})

// The fields being made now belong to the open editor and what it shows (the entry, the scene, the thing chosen): a
// draft is offered back to the same field of the same view. Asked when a field is made, so it is never a step behind.
drafts.place = () =>
  mounted === undefined
    ? ''
    : [mounted.editor.id, entry?.id ?? '', mounted.editor.draftView?.(mounted.session) ?? ''].join(':')

// The page going away (a closed tab, a phone put to sleep) writes the words that wait; where a browser asks "Leave
// site?" it asks while words wait or a write runs.
$effect(() => {
  const stopHide = flushOnHide({ flush: async () => drafts.flush() }, { document, window })
  const stopGuard = guardLeaving(window, () => drafts.waiting > 0 || editing.inFlight > 0)
  return () => {
    stopHide()
    stopGuard()
  }
})

// Undo and Redo act on the open editor's own history, or the suite's (an import) with none open (EDS-D19).
const owner = $derived(mounted?.editor.id ?? '')
const undoHook = $derived(mounted?.editor.undo?.(mounted.session))
const history = suiteHistory({
  session: () => editing,
  owner: () => owner,
  hook: () => undoHook,
  onrefused: refused,
})

function refused(outcome: WriteOutcome | undefined): void {
  const message = refusalMessage(outcome)
  if (message !== undefined) toasts.push({ kind: 'error', message })
}

// Publish on a game's own folder builds the zip to upload; Play that is off says why.
let publishingGame = $state(false)
let playOffOpen = $state(false)

function locate(finding: CheckFinding): void {
  toasts.push({ kind: 'info', message: findingMessage(finding) })
}

/** Mod+Z and Mod+Shift+Z, except in a text field, which keeps its own undo. */
function shortcuts(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  const field =
    event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')
  const key = event.key.toLowerCase()
  if (key === 'z' && field === null) {
    event.preventDefault()
    void (event.shiftKey ? history.redo() : history.undo())
  }
}

function showView(editor: SuiteEditor<unknown>, session: unknown, view: string | undefined): void {
  if (view !== undefined) editor.showView?.(session, view)
}

function choose(id: string | undefined): void {
  // Opened sessions are kept whatever Home now lists; only the cards change.
  void reread?.().then((read) => (latest = read))
  const chosen = entries.find((candidate) => candidate.id === id)
  const kept = chosen === undefined ? undefined : suite.editor(chosen.editors[0] ?? '')
  if (kept !== undefined && kept.id in sessions) showView(kept, sessions[kept.id], chosen?.view)
  current = id
  onEditor?.(id)
  reading = undefined
  panelOpen = false
  inspectorOpen = false
  dockOpen = undefined
}

function openCard(card: EditorCard): void {
  if (card.entry !== undefined) choose(card.entry)
}
</script>

<EditorShell
  {geometry}
  bind:panelOpen
  bind:inspectorOpen
  bind:dockOpen
  panel={mounted?.editor.regions.panel ? panel : undefined}
  inspector={mounted?.editor.regions.inspector ? inspector : undefined}
  dock={mounted?.editor.regions.dock ? dock : undefined}
  status={mounted?.editor.regions.status ? status : undefined}
  rail={folded ? undefined : tabs}
  testId="suite-shell"
  topbarRows={lineBelow ? 2 : 1}
>
  {#snippet sheets()}<ToastRegion {toasts} />{/snippet}
  {#snippet topbar()}
    <IconButton
      icon="home"
      label="Home"
      aria-current={current === undefined && reading === undefined ? 'page' : undefined}
      onclick={() => choose(undefined)}
    />
    <!-- The game's name is the title; the sample says it is one in a banner over Home instead (12.7, Step G). -->
    <SuiteTopBar
      title={sample ? 'Sample game' : (game ?? 'Your game')}
      {line}
      {lineBelow}
      titleHref={gameKey !== undefined ? '?games' : undefined}
      pills={pillsToShow(pills)}
      {compact}
      onlocate={locate}
      history={undoHook !== undefined || history.canUndo || history.canRedo ? history : undefined}
      onundo={history.undo}
      onredo={history.redo}
      {playUrl}
      {playOff}
      onplayoff={() => (playOffOpen = true)}
      gameMenu={mode === 'compact'}
      onpublish={publish !== undefined ? () => (publishingGame = true) : undefined}
      tools={mounted?.editor.regions.tools ? editorTools : undefined}
      onchoose={conflicts.length > 0 ? () => (putAway = false) : undefined}
    />
    {#if folded}<Menu label="Editors" items={editorMenu} onselect={choose} />{/if}
    {#if mounted?.editor.regions.panel && mode !== 'wide'}
      <IconButton icon="list" label="Panel" aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)} />
    {/if}
    {#if mounted?.editor.regions.inspector && mode !== 'wide'}
      <IconButton
        icon="inspector"
        label="Details"
        aria-expanded={inspectorOpen}
        onclick={() => (inspectorOpen = !inspectorOpen)}
      />
    {/if}
    {#if mounted?.editor.regions.dock && dockIsSheet}
      <Button aria-expanded={dockShown} onclick={() => (dockOpen = !dockShown)}>Dock</Button>
    {/if}
  {/snippet}

  {#snippet canvas()}
    {#if reading}
      <div class="page">
        <ReadOnlyFile file={reading} workspace={ports.workspace} onback={() => (reading = undefined)} />
      </div>
    {:else if mounted}
      {#key mounted.session}{@render mounted.editor.regions.canvas(mounted.session)}{/key}
    {:else if entry === undefined}
      <SuiteHome {home} {sample} {kept} own={gameKey !== undefined} onopen={openCard} onread={(file) => (reading = file)} />
    {:else}
      <Home
        title={entry.label}
        {home}
        entry={entry.id}
        empty={`Nothing to edit in ${entry.label} yet.`}
        onopen={openCard}
        onread={(file) => (reading = file)}
      />
    {/if}
  {/snippet}
</EditorShell>

<svelte:window onkeydown={shortcuts} />

<Dialog open={playOffOpen} title="Play is off" width="wide" onclose={() => (playOffOpen = false)}>
  {#each (playOff ?? '').split('\n') as line, index (index)}
    {#if index === 0}<p>{line}</p>{:else}<pre>{line}</pre>{/if}
  {/each}
  {#snippet actions()}<Button variant="primary" onclick={() => (playOffOpen = false)}>Close</Button>{/snippet}
</Dialog>
{#if conflicts.length > 0 && !putAway && pending === 0}
  <SyncConflictDialog
    {conflicts}
    busy={choosing}
    failed={choiceFailed}
    onchoose={chooseConflict}
    onlater={() => (putAway = true)}
  />
{/if}
{#if publish !== undefined}<PublishGameDialog {publish} bind:open={publishingGame} />{/if}

{#snippet tabs({ orientation }: { orientation: 'vertical' | 'horizontal' })}<SuiteRail {entries} {current} {orientation} onselect={choose} />{/snippet}
{#snippet editorTools()}{#if mounted?.editor.regions.tools}{#key mounted.session}{@render mounted.editor.regions.tools(mounted.session)}{/key}{/if}{/snippet}
{#snippet panel()}{#if mounted?.editor.regions.panel}{#key mounted.session}{@render mounted.editor.regions.panel(mounted.session)}{/key}{/if}{/snippet}
{#snippet inspector()}{#if mounted?.editor.regions.inspector}{#key mounted.session}{@render mounted.editor.regions.inspector(mounted.session)}{/key}{/if}{/snippet}
{#snippet dock()}{#if mounted?.editor.regions.dock}{#key mounted.session}{@render mounted.editor.regions.dock(mounted.session)}{/key}{/if}{/snippet}
{#snippet status()}{#if mounted?.editor.regions.status}{#key mounted.session}{@render mounted.editor.regions.status(mounted.session)}{/key}{/if}{/snippet}

<style>
  .page {
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-5);
    background: var(--color-bg-app);
  }
  /* The "Play is off" dialog: a sentence, then (when the game printed something) what it printed. */
  pre {
    max-height: 12rem;
    margin: var(--space-2) 0 0;
    overflow: auto;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-mono-12);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
