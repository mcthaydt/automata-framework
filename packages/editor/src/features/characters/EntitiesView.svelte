<!--
  The Entities view.
  The panel lists the entity definitions and the level fields; the canvas previews the selected definition; the
  inspector edits the definition and its typed fields. Everything that decides is plain TypeScript
  (`entities-model.ts`, `entities-session.ts`); this file draws and forwards. Every edit is one undo step.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import StagePill from '../../shared/kit/shell/StagePill.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
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

const mode = $derived(shellModeAt(geometry.current))
const wide = $derived(mode === 'wide')
/** Where the pill with the list and Details floats below `wide`: at the stage's foot on a phone, its top on an iPad. */
const pillAt = $derived(mode === 'compact' ? 'dock' : 'top')
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
        <h2>This game has no characters to show</h2>
        <p>Your file is unchanged.</p>
      </div>
    {:else}
      <div class="frame">
      <div class="stage" data-scroll-region data-pill={wide ? undefined : pillAt}>
        {#if selection.def === undefined}
          <div class="none" role="status">
            <h2>Settings every level has</h2>
            <p>
              Every level has these settings ({project.levels.length === 1
                ? '1 level'
                : `${project.levels.length} levels`}). To change them for one level, open it in the Level view and tap
              Details.
            </p>
          </div>
        {:else}
          <DefinitionPreview {project} id={selection.def.id} {images} {imageUrl} {room} />
        {/if}
      </div>
      {#if !wide}
        <StagePill label="Characters controls" at={pillAt}>
          {#if mode === 'compact'}
            <IconButton
              icon="list"
              label="All characters"
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
      <EntityInspector {project} {selection} {session} />
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
    /* This stage is a page of words and pictures, not a canvas: it takes the tool chrome's light field, so its text
       reads in the chrome's ink (it was dark on the near-black cabinet). The pictures keep their own dark frames. */
    background: var(--bg);
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
