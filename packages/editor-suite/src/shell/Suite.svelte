<!--
  The suite (editor suite spec §4.1, §9, §10): one kit `EditorShell` around Home, the nine-entry switcher and the
  editor an entry opens. An entry that exactly one installed editor covers opens it: `open` runs once per entry for
  the app's life, so the editor's session (documents, history, selection, view state) outlives a switch (EDS-D12),
  and its regions fill the shell's. Any other entry shows its cards. The shell stays mounted through every switch and
  rotation; only what is inside its regions changes.
-->
<script lang="ts">
import { Button, createToasts, EditorShell, shellModeOf, ToastRegion } from '@mcthaydt/automata-editor-kit'
import type {
  CheckFinding,
  SuiteEditor,
  SuitePorts,
  WorkspaceFile,
} from '@mcthaydt/automata-editor-kit/ports'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { SvelteMap } from 'svelte/reactivity'
import { type AskState, createAskSession } from '../core/ask-session'
import type { Pill } from '../core/pills-model'
import type { WriteOutcome } from '../core/write-path'
import AskDialog from './AskDialog.svelte'
import type { Suite } from './create-suite'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'
import ReadOnlyFile from './ReadOnlyFile.svelte'
import SuitePills from './SuitePills.svelte'
import SuiteRail from './SuiteRail.svelte'
import { SUITE_ENTRIES } from './suite-entries'
import { createSuiteSession } from './suite-session'
import TitlePrompt from './TitlePrompt.svelte'

interface Props {
  geometry: GeometryState
  home: HomeState
  suite: Suite
  ports: SuitePorts
  sample: boolean
}

const { geometry, home, suite, ports, sample }: Props = $props()

let current = $state<string | undefined>()
let reading = $state<WorkspaceFile | undefined>()
let panelOpen = $state(false)
let inspectorOpen = $state(false)
const sessions = new SvelteMap<string, unknown>()
const opening = new Set<string>()

const mode = $derived(shellModeOf(geometry.current.formFactor))
const entry = $derived(SUITE_ENTRIES.find((candidate) => candidate.id === current))

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
  void editor.open(card.files, editing.ports).then(
    (session) => sessions.set(editor.id, session),
    () => opening.delete(editor.id),
  )
})

// Editing (flows 3 to 8): every editor is opened with ports whose writes take the suite's write path; the pills,
// Undo and Ask follow it. The session lives as long as the suite; a reload reads the pills back from the journal.
const editing = $derived(createSuiteSession(ports))
const toasts = createToasts()
let pills = $state<readonly Pill[]>([])
let titleOpen = $state(false)
let history = $state({ canUndo: false, canRedo: false, undoLabel: '', redoLabel: '' })
let tokens = $state<{ readonly used: number; readonly cap: number }>()
// Icons with counts in the `short` tier (spec §10) and on a phone, where full labels leave no room; never hidden.
const compact = $derived(geometry.current.heightTier === 'short' || mode === 'compact')

$effect(() => {
  const session = editing
  const read = () => {
    pills = session.pills()
    titleOpen = session.asking()
    tokens = session.tokens()
    const path = session.writePath
    history = {
      canUndo: path.canUndo(),
      canRedo: path.canRedo(),
      undoLabel: path.undoLabel() ?? '',
      redoLabel: path.redoLabel() ?? '',
    }
  }
  const stop = session.subscribe(read)
  read()
  void session.refresh()
  // Locks live only in the page (EDS-D18), so a change set still open from before the reload has lost them.
  void ports.changeSet?.current().then((open) => {
    if (open !== undefined)
      toasts.push({ kind: 'info', message: 'Locked values were cleared when the page reloaded.' })
  })
  return stop
})

const undoHook = $derived(mounted?.editor.undo?.(mounted.session))
const askTarget = $derived(mounted?.editor.ask?.(mounted.session))
const ask = $derived(
  askTarget === undefined
    ? undefined
    : createAskSession({ target: askTarget, ports, writePath: editing.writePath }),
)
let askOpen = $state(false)
let askView = $state<AskState>({ kind: 'idle' })

// A routed write records the editor's own label for the step it just applied.
$effect(() => {
  const hook = undoHook
  editing.label = () => hook?.undoLabel() ?? 'Edit'
})

// The Ask session's state, and its rule: an edit, undo or redo in the document drops a proposal in flight or on show.
$effect(() => {
  const session = ask
  if (session === undefined) return
  askView = session.state()
  // A reply has spent tokens through the change set, so the meter reads the journal again.
  const stopState = session.subscribe(() => {
    askView = session.state()
    if (askView.kind === 'shown' || askView.kind === 'over-budget') void editing.refresh()
  })
  const stopHistory = undoHook?.subscribe(() => session.drop())
  return () => {
    stopState()
    stopHistory?.()
  }
})

function refused(outcome: WriteOutcome | undefined): void {
  if (outcome === undefined || 'written' in outcome || 'cancelled' in outcome) return
  const message =
    outcome.refused === 'moved'
      ? `${outcome.path} changed since this step was written, so it was not undone.`
      : outcome.refused === 'checks'
        ? outcome.findings.map((finding) => finding.message).join('; ')
        : outcome.refused === 'policy'
          ? outcome.why
          : outcome.message
  toasts.push({ kind: 'error', message })
}

async function undo(): Promise<void> {
  if (undoHook === undefined || !history.canUndo) return
  const outcome = await editing.undo()
  if (outcome !== undefined && 'written' in outcome) undoHook.undo()
  else refused(outcome)
}

async function redo(): Promise<void> {
  if (undoHook === undefined || !history.canRedo) return
  const outcome = await editing.redo()
  if (outcome !== undefined && 'written' in outcome) undoHook.redo()
  else refused(outcome)
}

async function accept(): Promise<void> {
  const outcome = await ask?.accept()
  if (outcome === undefined) return
  if ('written' in outcome) {
    askOpen = false
    void editing.follow(outcome)
  } else refused(outcome)
}

function locate(finding: CheckFinding): void {
  const where = [
    finding.path,
    finding.keyPath ?? (finding.line === undefined ? undefined : `line ${finding.line}`),
  ]
  toasts.push({ kind: 'info', message: `${where.filter(Boolean).join(', ')}: ${finding.message}` })
}

/** Mod+Z, Mod+Shift+Z and Mod+K, except in a text field, which keeps its own undo. */
function shortcuts(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  const field =
    event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')
  const key = event.key.toLowerCase()
  if (key === 'z' && field === null) {
    event.preventDefault()
    void (event.shiftKey ? redo() : undo())
  } else if (key === 'k' && ask !== undefined && !event.shiftKey) {
    event.preventDefault()
    askOpen = true
  }
}

function choose(id: string | undefined): void {
  current = id
  reading = undefined
  panelOpen = false
  inspectorOpen = false
}

function openCard(card: EditorCard): void {
  if (card.entry !== undefined) choose(card.entry)
}
</script>

<EditorShell
  {geometry}
  bind:panelOpen
  bind:inspectorOpen
  panel={mounted ? panel : undefined}
  inspector={mounted ? inspector : undefined}
  dock={mounted?.editor.regions.dock ? dock : undefined}
  status={mounted?.editor.regions.status ? status : undefined}
  testId="suite-shell"
>
  {#snippet topbar()}
    <Button aria-current={current === undefined && reading === undefined ? 'page' : undefined} onclick={() => choose(undefined)}
      >Home</Button
    >
    {#if mode !== 'compact'}<span class="brand">Editors</span>{/if}
    {#if sample}<span class="sample">Sample game</span>{/if}
    <!-- The pills and the editing tools scroll sideways when the bar is short of room; Home, Panel and Details stay. -->
    <div class="tools" data-scroll-region="both">
    <SuitePills {pills} {compact} onlocate={locate} />
    <span class="spacer"></span>
    {#if undoHook !== undefined}
      <Button disabled={!history.canUndo} aria-label={history.canUndo ? `Undo ${history.undoLabel}` : 'Undo'} onclick={undo}
        >↶</Button
      >
      <Button disabled={!history.canRedo} aria-label={history.canRedo ? `Redo ${history.redoLabel}` : 'Redo'} onclick={redo}
        >↷</Button
      >
    {/if}
    {#if ask !== undefined}<Button onclick={() => (askOpen = true)}>Ask</Button>{/if}
    {#if mounted?.editor.regions.tools}{@render mounted.editor.regions.tools(mounted.session)}{/if}
    </div>
    {#if mounted && mode !== 'wide'}
      <Button aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)}>Panel</Button>
      <Button aria-expanded={inspectorOpen} onclick={() => (inspectorOpen = !inspectorOpen)}>Details</Button>
    {/if}
  {/snippet}

  {#snippet rail({ orientation }: { orientation: 'vertical' | 'horizontal' })}
    <SuiteRail entries={SUITE_ENTRIES} {current} {orientation} onselect={choose} />
  {/snippet}

  {#snippet canvas()}
    {#if reading}
      <div class="page">
        <ReadOnlyFile file={reading} workspace={ports.workspace} onback={() => (reading = undefined)} />
      </div>
    {:else if mounted}
      {@render mounted.editor.regions.canvas(mounted.session)}
    {:else if entry === undefined}
      <Home title="This game's editors" {home} empty="The editor list names no files." onopen={openCard} onread={(file) => (reading = file)} />
    {:else if entry.id === 'review'}
      <Home title="Review" {home} empty="" onopen={openCard} onread={(file) => (reading = file)}>
        <p class="note">The Review desk comes in a later update. Your files are safe.</p>
      </Home>
    {:else}
      <Home
        title={entry.label}
        {home}
        editors={entry.editors}
        empty={`This game's editor list names no files for ${entry.label}.`}
        onopen={openCard}
        onread={(file) => (reading = file)}
      />
    {/if}
  {/snippet}
</EditorShell>

<svelte:window onkeydown={shortcuts} />

<TitlePrompt open={titleOpen} onsubmit={(title) => editing.answerTitle(title)} oncancel={() => editing.answerTitle(undefined)} />
{#if ask !== undefined && askTarget !== undefined}
  <AskDialog
    open={askOpen}
    view={askView}
    scope={askTarget.scope()}
    {tokens}
    onask={(prompt) => void ask?.ask(prompt)}
    onaccept={() => void accept()}
    onreject={() => ask?.reject()}
    onrewrite={() => void ask?.rewrite()}
    onclose={() => (askOpen = false)}
  />
{/if}
<ToastRegion {toasts} />

{#snippet panel()}{#if mounted}{@render mounted.editor.regions.panel(mounted.session)}{/if}{/snippet}
{#snippet inspector()}{#if mounted}{@render mounted.editor.regions.inspector(mounted.session)}{/if}{/snippet}
{#snippet dock()}{#if mounted?.editor.regions.dock}{@render mounted.editor.regions.dock(mounted.session)}{/if}{/snippet}
{#snippet status()}{#if mounted?.editor.regions.status}{@render mounted.editor.regions.status(mounted.session)}{/if}{/snippet}

<style>
  .brand {
    font: var(--text-title-15);
  }
  .sample {
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .spacer {
    flex: 1;
  }
  .tools {
    display: flex;
    flex: 1 1 auto;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tools > :global(*) {
    flex-shrink: 0;
  }
  .page {
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-5);
    background: var(--color-bg-app);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
