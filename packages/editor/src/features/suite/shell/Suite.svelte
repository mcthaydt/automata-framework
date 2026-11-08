<!--
  The suite: one kit `EditorShell` around Home, the nine-entry switcher and the
  editor an entry opens. An entry that exactly one installed editor covers opens it: `open` runs once per entry for
  the app's life, so the editor's session (documents, history, selection, view state) outlives a switch (EDS-D12),
  and its regions fill the shell's. Any other entry shows its cards. The shell stays mounted through every switch and
  rotation; only what is inside its regions changes. Home is `SuiteHome`, Undo and Redo are `suite-history`, and what a refused write says is
  `core/write-messages` (split by responsibility in 12.7 and 12.5).
-->
<script lang="ts">
import type { GeometryState } from '@automata/framework'
import { SvelteMap } from 'svelte/reactivity'
import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor'
import type { CheckFinding, SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import EditorShell from '../../../shared/kit/shell/EditorShell.svelte'
import { defaultDockOpen, dockPlacementOf, shellModeAt } from '../../../shared/kit/shell/shell-mode'
import Button from '../../../shared/kit/widgets/Button.svelte'
import IconButton from '../../../shared/kit/widgets/IconButton.svelte'
import ToastRegion from '../../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../../shared/kit/widgets/toasts'
import { type Pill, pillsToShow } from '../core/pills-model'
import { findingMessage, refusalMessage } from '../core/write-messages'
import type { Suite } from './create-suite'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'
import ReadOnlyFile from './ReadOnlyFile.svelte'
import SuiteHome from './SuiteHome.svelte'
import SuiteRail from './SuiteRail.svelte'
import SuiteTopBar from './SuiteTopBar.svelte'
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
  /** Reads Home again (on each return to it); without it, Home stays as it was given. */
  reread?: (() => Promise<HomeState>) | undefined
}

const { geometry, home: given, suite, ports, sample, game, reread }: Props = $props()
let latest = $state<HomeState>()
const home = $derived(latest ?? given)

let current = $state<string | undefined>()
let reading = $state<WorkspaceFile | undefined>()
let panelOpen = $state(false)
let inspectorOpen = $state(false)
/** `undefined` follows the shell's default for the size. */
let dockOpen = $state<boolean | undefined>()
const sessions = new SvelteMap<string, unknown>()
const opening = new Set<string>()

const mode = $derived(shellModeAt(geometry.current))
// Where the dock is a sheet (below `wide`, or short), the top bar opens and closes it, as Panel and Details do theirs.
const dockIsSheet = $derived(dockPlacementOf(mode, geometry.current.heightTier) !== 'inline')
const dockShown = $derived(dockOpen ?? defaultDockOpen(mode, geometry.current.heightTier))
// The rail: the editors this page registered.
const entries = $derived(suiteEntries(suite.editors))
const entry = $derived(entries.find((candidate) => candidate.id === current))

// The installed editor the chosen entry opens: only when exactly one of its editors is both named and installed.
const target = $derived.by((): { editor: SuiteEditor<unknown>; card: EditorCard } | undefined => {
  if (entry === undefined || home.kind !== 'cards') return undefined
  const installed = home.cards.filter((card) => card.installed && entry.editors.includes(card.editor))
  const card = installed.length === 1 ? installed[0] : undefined
  const editor = card === undefined ? undefined : suite.editor(card.editor)
  return card === undefined || editor === undefined ? undefined : { editor, card }
})
const mounted = $derived(
  target !== undefined && reading === undefined && sessions.has(target.editor.id)
    ? { editor: target.editor, session: sessions.get(target.editor.id) }
    : undefined,
)

$effect(() => {
  if (target === undefined) return
  const { editor, card } = target
  if (sessions.has(editor.id) || opening.has(editor.id)) return
  opening.add(editor.id)
  void editor.open(card.files, editing.portsFor(editor.id)).then(
    (session) => sessions.set(editor.id, session),
    () => opening.delete(editor.id),
  )
})

// Editing (flows 3 to 8): every editor is opened with ports whose writes take the suite's write path; the pills and
// Undo follow it. The session lives as long as the suite.
const editing = $derived(createSuiteSession(ports))
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

function choose(id: string | undefined): void {
  // Opened sessions are kept whatever Home now lists; only the cards change.
  void reread?.().then((read) => (latest = read))
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
  testId="suite-shell"
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
      title={mode === 'compact' ? undefined : sample ? 'Sample game' : (game ?? 'Your game')}
      saved={!sample && !compact}
      pills={pillsToShow(pills)}
      {compact}
      onlocate={locate}
      history={undoHook !== undefined || history.canUndo || history.canRedo ? history : undefined}
      onundo={history.undo}
      onredo={history.redo}
      tools={mounted?.editor.regions.tools ? editorTools : undefined}
    />
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

  {#snippet rail({ orientation }: { orientation: 'vertical' | 'horizontal' })}
    <SuiteRail {entries} {current} {orientation} onselect={choose} />
  {/snippet}

  {#snippet canvas()}
    {#if reading}
      <div class="page">
        <ReadOnlyFile file={reading} workspace={ports.workspace} onback={() => (reading = undefined)} />
      </div>
    {:else if mounted}
      {@render mounted.editor.regions.canvas(mounted.session)}
    {:else if entry === undefined}
      <SuiteHome {home} {sample} onopen={openCard} onread={(file) => (reading = file)} />
    {:else}
      <Home
        title={entry.label}
        {home}
        editors={entry.editors}
        empty={`Nothing to edit in ${entry.label} yet.`}
        onopen={openCard}
        onread={(file) => (reading = file)}
      />
    {/if}
  {/snippet}
</EditorShell>

<svelte:window onkeydown={shortcuts} />

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
</style>
