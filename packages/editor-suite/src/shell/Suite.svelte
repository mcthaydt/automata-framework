<!--
  The suite (editor suite spec §4.1, §9, §10): one kit `EditorShell` around Home, the nine-entry switcher and the
  editor an entry opens. An entry that exactly one installed editor covers opens it: `open` runs once per entry for
  the app's life, so the editor's session (documents, history, selection, view state) outlives a switch (EDS-D12),
  and its regions fill the shell's. Any other entry shows its cards. The shell stays mounted through every switch and
  rotation; only what is inside its regions changes.
-->
<script lang="ts">
import { Button, EditorShell, shellModeOf } from '@mcthaydt/automata-editor-kit'
import type { SuiteEditor, SuitePorts, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { SvelteMap } from 'svelte/reactivity'
import type { Suite } from './create-suite'
import Home from './Home.svelte'
import type { EditorCard, HomeState } from './home-model'
import ReadOnlyFile from './ReadOnlyFile.svelte'
import SuiteRail from './SuiteRail.svelte'
import { SUITE_ENTRIES } from './suite-entries'

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
  void editor.open(card.files, ports).then(
    (session) => sessions.set(editor.id, session),
    () => opening.delete(editor.id),
  )
})

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
    <span class="brand">Editors</span>
    {#if sample}<span class="sample">Sample game</span>{/if}
    <span class="spacer"></span>
    {#if mounted && mode !== 'wide'}
      <Button aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)}>Panel</Button>
      <Button aria-expanded={inspectorOpen} onclick={() => (inspectorOpen = !inspectorOpen)}>Details</Button>
    {/if}
    {#if mounted?.editor.regions.tools}{@render mounted.editor.regions.tools(mounted.session)}{/if}
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
