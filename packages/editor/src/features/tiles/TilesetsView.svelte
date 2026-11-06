<!--
  The Tilesets view.
  The panel lists the tilesets, the auto layers, the selected layer's rule groups and the selected group's rules as a
  strip a grip reorders; the canvas shows the tileset as tiles with its tags, above the live preview; the inspector
  edits the selected rule or group. Everything that decides is plain TypeScript (`tilesets-model.ts`,
  `rule-preview.ts`, `tilesets-session.ts`); this file draws and forwards. Every edit is one undo step.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import StagePill from '../../shared/kit/shell/StagePill.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { ViewProps } from '../document/view-props'
import RuleInspector from './RuleInspector.svelte'
import RulePreview from './RulePreview.svelte'
import { rulePreview } from './rule-preview'
import TilesetSheet from './TilesetSheet.svelte'
import TilesetsPanel from './TilesetsPanel.svelte'
import { createTilesetsSession } from './tilesets-session'

const { geometry, document: opened, frame, services }: ViewProps = $props()

// The view is made for one document: the screen remounts it when the document is replaced (Take theirs).
// svelte-ignore state_referenced_locally
const session = createTilesetsSession({ history: opened.history, ids: services.ids })

let project = $state.raw<Project | undefined>(session?.project)
let selection = $state.raw(session?.selection)
let panelOpen = $state(false)
let inspectorOpen = $state(false)
/** Object URLs of the tileset images, by workspace path. */
let urls = $state.raw<ReadonlyMap<string, string>>(new Map())

const stop = session?.subscribe(() => {
  project = session.project
  selection = session.selection
})

const mode = $derived(shellModeAt(geometry.current))
const wide = $derived(mode === 'wide')
/** Where the pill with the list and Details floats below `wide`: at the stage's foot on a phone, its top on an iPad. */
const pillAt = $derived(mode === 'compact' ? 'dock' : 'top')
const images = $derived(new Set(urls.keys()))
const tileset = $derived(project?.defs.tilesets.find((set) => set.id === selection?.tileset))
const preview = $derived(
  project === undefined || selection?.layer === undefined || selection.value === undefined
    ? undefined
    : rulePreview(project, selection.layer, selection.value, selection.rule),
)
const imageUrl = (path: string): string | undefined => urls.get(path)

// Each tileset image is read once and shown through an object URL, let go when the view goes.
$effect(() => {
  const make = services.objectUrls
  const paths = (project?.defs.tilesets ?? []).flatMap((set) => (set.image === undefined ? [] : [set.image]))
  if (make === undefined) return
  for (const path of paths) {
    if (urls.has(path)) continue
    void services.read(path).then((bytes) => {
      if (bytes === undefined || urls.has(path)) return
      urls = new Map([...urls, [path, make.create(bytes)]])
    })
  }
})

onDestroy(() => {
  stop?.()
  session?.dispose()
  for (const url of urls.values()) services.objectUrls?.revoke(url)
})
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  sheets={frame.sheets}
  bind:panelOpen
  bind:inspectorOpen
  testId="tilesets-view"
>
  {#snippet panel()}
    {#if session !== undefined && project !== undefined && selection !== undefined}
      <TilesetsPanel {project} {selection} {session} {images} {imageUrl} />
    {/if}
  {/snippet}

  {#snippet canvas()}
    {#if session === undefined || project === undefined || selection === undefined}
      <div class="refused" role="status">
        <h2>This game has no tiles to show</h2>
        <p>Your file is unchanged.</p>
      </div>
    {:else}
      <div class="frame">
      <div class="stage" data-scroll-region data-pill={wide ? undefined : pillAt}>
        {#if tileset === undefined}
          <p class="none" role="status">No tiles yet. Add a picture of your tiles to paint with them.</p>
        {:else}
          <TilesetSheet {tileset} {selection} {session} {images} {imageUrl} />
        {/if}
        {#if preview !== undefined}
          <RulePreview {preview} {project} {selection} {images} {imageUrl} />
        {/if}
      </div>
      {#if !wide}
        <StagePill label="Tiles controls" at={pillAt}>
          {#if mode === 'compact'}
            <IconButton
              icon="list"
              label="All tiles"
              showLabel
              aria-expanded={panelOpen}
              onclick={() => (panelOpen = !panelOpen)}
            />
          {/if}
          <IconButton
            icon="inspector"
            label="Details"
            showLabel
            aria-expanded={inspectorOpen}
            onclick={() => (inspectorOpen = !inspectorOpen)}
          />
        </StagePill>
      {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet inspector()}
    {#if session !== undefined && project !== undefined && selection !== undefined}
      <RuleInspector {project} {selection} {session} {images} {imageUrl} />
    {/if}
  {/snippet}
</EditorShell>

<style>
  /* The stage scrolls inside the frame; the pill floats over the frame, so it stays put while the stage scrolls. */
  .frame {
    position: relative;
    height: 100%;
  }
  .stage {
    position: absolute;
    inset: 0;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4) var(--space-5);
    overflow: auto;
    overscroll-behavior: contain;
  }
  /* Room for the pill (a 44 px control, its padding, its edge and its margin), so it never covers the first or last
     thing on the stage. */
  .stage[data-pill='top'] {
    padding-top: calc(var(--size-hit) + 2 * var(--space-1) + 2px + 2 * var(--space-3));
  }
  .stage[data-pill='bottom'],
  .stage[data-pill='dock'] {
    padding-bottom: calc(var(--size-hit) + 2 * var(--space-1) + 2px + 2 * var(--space-3));
  }
  .none,
  .refused {
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .refused h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .refused p {
    margin: 0;
  }
</style>
