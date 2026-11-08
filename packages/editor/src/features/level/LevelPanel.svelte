<!--
  The Level view's panel: the layers above the palette, drawn from
  a session that outlives it. Palette sprites: each tileset image is read once and shown through an object URL, let go
  when the panel goes.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { History } from '../../shared/kit/history/history'
import Picker from '../../shared/kit/widgets/Picker.svelte'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import { setLayerTileset } from '../../shared/level-2d/model/commands/layer-def-edits'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import { commitEdit } from '../../shared/level-2d/model/field-commit'
import { type PaletteItem, paletteOf } from '../../shared/level-2d/tiles/palette-model'
import LayersPanel from './LayersPanel.svelte'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'
import Palette from './Palette.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
}

const { session, history, read, objectUrls }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)
/** Object URLs of the tileset images the palette shows, by workspace path. */
let urls = $state.raw<ReadonlyMap<string, string>>(new Map())

const layers = $derived(level.project.defs.layers)
const layerDef = $derived(layers.find((layer) => layer.id === level.view.layer))
const palette = $derived(paletteOf(level.project, level.view.layer, new Set(urls.keys())))

// A tile layer draws one tileset; with more than one in the game (Add tiles made another), the person says which this
// layer paints with, as one step Undo takes back. A sentence from the model, if it refuses, is shown under the picker.
const tilesets = $derived(level.project.defs.tilesets)
const tilesFrom = $derived(
  layerDef !== undefined && (layerDef.kind === 'tiles' || layerDef.kind === 'objects') && tilesets.length > 1
    ? layerDef
    : undefined,
)
let refusal = $state<string | undefined>(undefined)

function useTileset(id: string): void {
  const edits = projectHistory(history)
  if (edits === undefined || tilesFrom === undefined) return
  const done = commitEdit(edits, `Use ${id} for ${tilesFrom.label}`, (project) =>
    setLayerTileset(project, tilesFrom.id, id),
  )
  refusal = done.ok ? undefined : done.message
}

function choose(item: PaletteItem): void {
  if (item.kind === 'entity') session.editor.setEntityDef(item.def)
  else session.editor.setWord(item.word)
}

$effect(() => {
  const make = objectUrls
  const paths = level.project.defs.tilesets.flatMap((set) => (set.image === undefined ? [] : [set.image]))
  if (make === undefined) return
  for (const path of paths) {
    if (urls.has(path)) continue
    void read(path).then((bytes) => {
      if (bytes === undefined || urls.has(path)) return
      urls = new Map([...urls, [path, make.create(bytes)]])
    })
  }
})

onDestroy(() => {
  for (const url of urls.values()) objectUrls?.revoke(url)
})
</script>

<div class="panel">
  <LayersPanel
    {layers}
    current={level.view.layer}
    hidden={level.view.hidden}
    locked={level.view.locked}
    onselect={(id) => session.editor.setLayer(id)}
    onhidden={(id, hidden) => session.editor.setHidden(id, hidden)}
    onlocked={(id, locked) => session.editor.setLocked(id, locked)}
  />
  {#if tilesFrom !== undefined}
    <div class="from">
      <Picker
        label="Tiles from"
        options={tilesets.map((set) => ({ id: set.id, label: set.label }))}
        value={tilesFrom.tileset}
        onpick={useTileset}
      />
      {#if refusal !== undefined}<p role="alert">{refusal}</p>{/if}
    </div>
  {/if}
  <Palette
    layer={layerDef?.label ?? ''}
    items={palette.items}
    word={level.view.word}
    entityDef={level.view.entityDef}
    imageUrl={(path) => urls.get(path)}
    onchoose={choose}
  />
</div>

<style>
  .panel {
    display: grid;
    align-content: start;
  }
  .from {
    padding: var(--space-2) var(--space-3);
  }
  .from p {
    margin: var(--space-1) 0 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
