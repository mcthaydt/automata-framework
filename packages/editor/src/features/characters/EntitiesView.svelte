<!--
  The Entities view.
  The panel lists the entity definitions and the level fields; the canvas previews the selected definition; the
  inspector edits the definition and its typed fields. Everything that decides is plain TypeScript
  (`entities-model.ts`, `entities-session.ts`); this file draws and forwards. Every edit is one undo step.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import { shellModeOf } from '../../shared/kit/shell/shell-mode'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { ViewProps } from '../../shared/level-2d/session/view-props'
import DefinitionPreview from './DefinitionPreview.svelte'
import EntitiesPanel from './EntitiesPanel.svelte'
import EntityInspector from './EntityInspector.svelte'
import { createEntitiesSession } from './entities-session'

const { geometry, document: opened, frame, services }: ViewProps = $props()

// The view is made for one document: the screen remounts it when the document is replaced (Take theirs).
// svelte-ignore state_referenced_locally
const session = createEntitiesSession({ history: opened.history, ids: services.ids })

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

const wide = $derived(shellModeOf(geometry.current.formFactor) === 'wide')
const images = $derived(new Set(urls.keys()))
// The preview's room by shell mode, so the scale is the same on every device of a mode: `wide`'s canvas is 554 px.
const room = $derived(wide ? { w: 420, h: 300 } : { w: 240, h: 240 })
const imageUrl = (path: string): string | undefined => urls.get(path)

// Each tileset image a definition draws with is read once and shown through an object URL, let go when the view goes.
$effect(() => {
  const make = services.objectUrls
  const used = new Set(
    (project?.defs.entities ?? []).flatMap((def) => (def.tile === undefined ? [] : [def.tile.tileset])),
  )
  const paths = (project?.defs.tilesets ?? []).flatMap((set) =>
    set.image === undefined || !used.has(set.id) ? [] : [set.image],
  )
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
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  bind:panelOpen
  bind:inspectorOpen
  testId="entities-view"
>
  {#snippet panel()}
    {#if session !== undefined && project !== undefined && selection !== undefined}
      <EntitiesPanel {project} {selection} {session} />
    {/if}
  {/snippet}

  {#snippet canvas()}
    {#if session === undefined || project === undefined || selection === undefined}
      <div class="refused" role="status">
        <h2>This document has no entity definitions to show</h2>
        <p>Your file is unchanged.</p>
      </div>
    {:else}
      <div class="stage" data-scroll-region>
        {#if !wide}
          <div class="drawers">
            <button type="button" aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)}>Definitions</button>
            <button type="button" aria-expanded={inspectorOpen} onclick={() => (inspectorOpen = !inspectorOpen)}
              >Inspector</button
            >
          </div>
        {/if}
        {#if selection.def === undefined}
          <div class="none" role="status">
            <h2>Level fields</h2>
            <p>
              Every level carries these fields ({project.levels.length === 1
                ? '1 level'
                : `${project.levels.length} levels`}); the Level view’s Level tab edits their values.
            </p>
          </div>
        {:else}
          <DefinitionPreview {project} id={selection.def.id} {images} {imageUrl} {room} />
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet inspector()}
    {#if session !== undefined && project !== undefined && selection !== undefined}
      <EntityInspector {project} {selection} {session} />
    {/if}
  {/snippet}
</EditorShell>

<style>
  .stage {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    height: 100%;
    padding: var(--space-3) var(--space-4) var(--space-5);
    overflow: auto;
    overscroll-behavior: contain;
  }
  .drawers {
    display: flex;
    gap: var(--space-2);
  }
  .drawers button {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .none,
  .refused {
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .none h2,
  .refused h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .none p,
  .refused p {
    margin: 0;
  }
</style>
