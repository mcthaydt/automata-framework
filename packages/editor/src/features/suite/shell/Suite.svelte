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
import type { EditorHeader, SuiteEditor } from '../../../shared/kit/ports/suite-editor'
import type { CheckFinding, SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import EditorShell from '../../../shared/kit/shell/EditorShell.svelte'
import { defaultDockOpen, dockPlacementOf, shellModeAt } from '../../../shared/kit/shell/shell-mode'
import type { GamePublish } from '../../../shared/kit/storage/publish-client'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import ToastRegion from '../../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../../shared/kit/widgets/toasts'
import { checksPill, type Pill } from '../core/pills-model'
import { problemCounts } from '../core/problem-counts'
import { findingMessage, refusalMessage } from '../core/write-messages'
import type { Suite } from './create-suite'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'
import PublishGameDialog from './PublishGameDialog.svelte'
import ReadOnlyFile from './ReadOnlyFile.svelte'
import SuiteHeader from './SuiteHeader.svelte'
import SuiteHome from './SuiteHome.svelte'
import SuiteRail from './SuiteRail.svelte'
import { suiteEntries } from './suite-entries'
import { suiteHistory } from './suite-history.svelte'
import { createSuiteSession } from './suite-session'

interface Props {
  geometry: GeometryState
  home: HomeState
  suite: Suite
  ports: SuitePorts
  sample: boolean
  /** The game's name in words, from the server; the title. */
  game?: string | undefined
  /** The running game's page, from the server: Play opens it. */
  playUrl?: string | undefined
  /** Why Play is off (the game could not start), from the server: Play says it when pressed. */
  playOff?: string | undefined
  /** Builds the game into a zip to upload, on a game's own folder: Publish opens it. */
  publish?: GamePublish | undefined
  /** Reads Home again (on each return to it); without it, Home stays as it was given. */
  reread?: (() => Promise<HomeState>) | undefined
}

const {
  geometry,
  home: given,
  suite,
  ports,
  sample,
  game,
  playUrl,
  playOff,
  publish,
  reread,
}: Props = $props()
let latest = $state<HomeState>()
const home = $derived(latest ?? given)

let current = $state<string | undefined>()
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
const gameName = $derived(sample ? 'Sample game' : (game ?? 'Your game'))

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

/** Whether the open editor has a panel, details or dock to toggle where the window has no room to show them. */
const hasToggles = $derived(
  mounted !== undefined &&
    ((mounted.editor.regions.panel !== undefined && mode !== 'wide') ||
      (mounted.editor.regions.inspector !== undefined && mode !== 'wide') ||
      (mounted.editor.regions.dock !== undefined && dockIsSheet)),
)

$effect(() => {
  if (target === undefined) return
  const { editor, card } = target
  if (editor.id in sessions || opening.has(editor.id)) return
  opening.add(editor.id)
  const asked = entry?.view
  void editor.open(card.files, editing.portsFor(editor.id)).then(
    (session) => {
      // The view of the entry now chosen if it is still this editor's, else the one that asked: the right view draws
      // first, and an effect would paint the old one for a frame.
      const now = entries.find((candidate) => candidate.id === current)
      showView(editor, session, now?.editors[0] === editor.id ? now.view : asked)
      sessions = { ...sessions, [editor.id]: session }
    },
    () => opening.delete(editor.id),
  )
})

// The open editor's breadcrumb ("Levels / Start ▾", its views): a store that follows the document and the view.
let editorHeader = $state<EditorHeader | undefined>()
$effect(() => {
  const open = mounted
  const store = open?.editor.header?.(open.session)
  if (store === undefined) {
    editorHeader = undefined
    return
  }
  return store.subscribe((header) => (editorHeader = header))
})

// Editing (flows 3 to 8): every editor is opened with ports whose writes take the suite's write path; the pills and
// Undo follow it. The session lives as long as the suite.
const editing = $derived(createSuiteSession(ports))
const toasts = createToasts()
let pills = $state<readonly Pill[]>([])
const checks = $derived(pills[0] ?? checksPill({ running: false, checks: [] }))
let findings = $state<readonly CheckFinding[]>([])
const counts = $derived(problemCounts(findings, home.kind === 'cards' ? home.cards : []))
// The problem count keeps its number and drops its word under 900 px; the header never hides it.
const short = $derived(geometry.current.layout.width < 900)

$effect(() => {
  const session = editing
  const read = () => {
    pills = session.pills()
    findings = session.reports().flatMap((report) => report.findings)
  }
  const stop = session.subscribe(read)
  read()
  void session.refresh()
  return stop
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
  rail={tabs}
  testId="suite-shell"
>
  {#snippet sheets()}<ToastRegion {toasts} />{/snippet}
  {#snippet topbar()}
    <SuiteHeader
      {mode}
      {short}
      game={gameName}
      editor={entry === undefined ? undefined : { label: entry.label, icon: entry.icon }}
      header={editorHeader}
      {checks}
      onlocate={locate}
      save={sample ? undefined : 'saved'}
      history={undoHook !== undefined || history.canUndo || history.canRedo ? history : undefined}
      onundo={history.undo}
      onredo={history.redo}
      {playUrl}
      {playOff}
      onplayoff={() => (playOffOpen = true)}
      onpublish={publish !== undefined ? () => (publishingGame = true) : undefined}
      onhome={() => choose(undefined)}
      atHome={current === undefined && reading === undefined}
      tools={mounted?.editor.regions.tools ? editorTools : undefined}
      toggles={hasToggles ? toggles : undefined}
    />
  {/snippet}

  {#snippet canvas()}
    {#if reading}
      <div class="page">
        <ReadOnlyFile file={reading} workspace={ports.workspace} onback={() => (reading = undefined)} />
      </div>
    {:else if mounted}
      {@render mounted.editor.regions.canvas(mounted.session, { mode })}
    {:else if entry === undefined}
      <SuiteHome {home} {sample} onopen={openCard} onread={(file) => (reading = file)} />
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
{#if publish !== undefined}<PublishGameDialog {publish} bind:open={publishingGame} />{/if}

{#snippet tabs({ presentation, standing }: { presentation: 'sidebar' | 'rail' | 'tabbar'; standing: boolean })}
  <SuiteRail
    {entries}
    {current}
    {presentation}
    {standing}
    game={{ name: gameName, letter: gameName.trim().charAt(0) || 'G' }}
    {counts}
    onselect={choose}
    onhome={() => choose(undefined)}
  />
{/snippet}
{#snippet toggles()}
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
{#snippet editorTools()}{#if mounted?.editor.regions.tools}{@render mounted.editor.regions.tools(mounted.session)}{/if}{/snippet}
{#snippet panel()}{#if mounted?.editor.regions.panel}{@render mounted.editor.regions.panel(mounted.session)}{/if}{/snippet}
{#snippet inspector()}{#if mounted?.editor.regions.inspector}{@render mounted.editor.regions.inspector(mounted.session)}{/if}{/snippet}
{#snippet dock()}{#if mounted?.editor.regions.dock}{@render mounted.editor.regions.dock(mounted.session)}{/if}{/snippet}
{#snippet status()}{#if mounted?.editor.regions.status}{@render mounted.editor.regions.status(mounted.session)}{/if}{/snippet}

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
