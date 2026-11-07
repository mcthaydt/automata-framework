<!--
  Add tiles (plan 12.3b): one dialog that turns a picture of tiles into something to paint with. Three steps on one
  screen: choose a picture, say how big one tile is (one stepper, in px), and see
  the picture with its grid drawn over it and the count in words. A size that does not fit says so and suggests sizes
  that do; Add tiles, the one primary action, waits until the picture and the size fit. It writes the picture into
  the game (under `assets/`, never over a file that is there), hands the tileset to `onadd` (the session's one undo
  step) and closes. A write that fails says so inside the dialog and adds nothing, so the person can try again.

  The words never name a format, a path or a "tileset": the person added a picture of tiles. Everything that decides is
  `add-tiles.ts`; this file draws it and does the two pieces of I/O (reading the chosen file, writing it).
-->
<script lang="ts">
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import type { FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { Size, TilesetDef } from '../../shared/level-2d/model/project-types'
import { PICTURE_TYPES, pictureAsset, tileGrid, tilesetFromPicture } from './add-tiles'

interface Props {
  open: boolean
  /** The tileset ids already in the project, so the new one gets a fresh id. */
  taken: readonly string[]
  /** Where the picture is written: the game folder, or the workspace in browser storage. */
  files: Pick<ProjectStore, 'list' | 'write'>
  /** The picture's size in px, or `undefined` when it is not a picture the browser can decode. */
  measure?: ((bytes: Uint8Array) => Promise<Size | undefined>) | undefined
  onadd: (def: TilesetDef) => FieldCommit
}

let { open = $bindable(), taken, files, measure = decodedSize, onadd }: Props = $props()

/** A browser decodes the picture to learn its size; a file it cannot decode is not a picture we can read. */
async function decodedSize(bytes: Uint8Array): Promise<Size | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]))
    const size = { w: bitmap.width, h: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return undefined
  }
}

interface Chosen {
  readonly name: string
  readonly bytes: Uint8Array
  readonly size: Size
  /** An object URL for the preview, where the browser makes them (not in jsdom). */
  readonly url: string | undefined
}

let chosen = $state.raw<Chosen | undefined>()
let tile = $state(16)
let trouble = $state<string | undefined>()
let busy = $state(false)

const grid = $derived(chosen === undefined ? undefined : tileGrid(chosen.size, tile))
const ready = $derived(grid !== undefined && grid.problem === undefined && !busy)

function forget(): void {
  if (chosen?.url !== undefined) URL.revokeObjectURL(chosen.url)
  chosen = undefined
}

async function pick(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined) return
  forget()
  trouble = undefined
  const bytes = new Uint8Array(await file.arrayBuffer())
  const size = await measure(bytes)
  if (size === undefined) {
    trouble = 'That file isn’t a picture we can read. Try a PNG, WebP or JPEG.'
    return
  }
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined
  chosen = { name: file.name, bytes, size, url }
}

/**
 * What a failed write says. A game that does not let the editor save pictures (`policy`) is not a fault to quote: the
 * person is told what is true and what to do. Any other failure carries its own plain sentence ("The disk is full.").
 */
function refusal(failed: { reason: string; message: string }): string {
  if (failed.reason === 'policy') {
    return 'This game doesn’t let the editor save pictures yet. Ask whoever set the game up to allow pictures in its assets folder.'
  }
  return `Couldn’t add the picture. ${failed.message}`
}

async function add(close: () => void): Promise<void> {
  if (chosen === undefined || !ready) return
  busy = true
  trouble = undefined
  try {
    const existing = (await files.list('assets/')).map((entry) => entry.path)
    const path = pictureAsset(chosen.name, existing)
    const written = await files.write(path, chosen.bytes, 'absent')
    if (!written.ok) {
      trouble = refusal(written)
      return
    }
    const done = onadd(tilesetFromPicture({ fileName: chosen.name, path, size: chosen.size, tile, taken }))
    if (!done.ok) {
      trouble = done.message
      return
    }
    forget()
    close()
  } finally {
    busy = false
  }
}

// Each time the dialog closes it lets the picture go, so the next Add tiles starts empty.
$effect(() => {
  if (!open) {
    forget()
    trouble = undefined
  }
})
</script>

<Dialog bind:open title="Add tiles">
  <div class="steps">
    <section>
      <label class="pick">
        <input type="file" accept={PICTURE_TYPES} aria-label="Choose a picture" onchange={pick} data-autofocus />
        <span aria-hidden="true">{chosen === undefined ? 'Choose a picture' : 'Choose another picture'}</span>
      </label>
      <!-- The file's own name, without its type: the person knows the picture by it. -->
      {#if chosen !== undefined}<p class="name" data-selectable>{chosen.name.replace(/\.[^.]*$/, '')}</p>{/if}
    </section>

    <section>
      <h3>How big is one tile?</h3>
      <div class="size">
        <Stepper
          label="Tile size"
          unit="px"
          value={tile}
          min={1}
          max={256}
          integer
          onedit={(event) => {
            if (event.phase === 'set' || event.phase === 'commit') tile = event.value
          }}
        />
      </div>
    </section>

    {#if chosen !== undefined && grid !== undefined}
      <section>
        <div
          class="preview"
          data-testid="add-tiles-preview"
          data-grid={`${grid.columns}x${grid.rows}`}
          style:aspect-ratio={`${chosen.size.w} / ${chosen.size.h}`}
          style:width={`min(100%, calc(33dvh * ${chosen.size.w / chosen.size.h}))`}
          style:--cell-w={`${(tile / chosen.size.w) * 100}%`}
          style:--cell-h={`${(tile / chosen.size.h) * 100}%`}
        >
          {#if chosen.url !== undefined}<img src={chosen.url} alt="" />{/if}
          <div class="grid" aria-hidden="true"></div>
        </div>
        {#if grid.summary !== undefined}<p class="summary">{grid.summary}</p>{/if}
        {#if grid.problem !== undefined}<p class="problem">{grid.problem}</p>{/if}
      </section>
    {/if}

    {#if trouble !== undefined}<p class="trouble" role="alert">{trouble}</p>{/if}
  </div>

  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
    <Button variant="primary" disabled={!ready} onclick={() => void add(close)}>Add tiles</Button>
  {/snippet}
</Dialog>

<style>
  .steps {
    display: grid;
    gap: var(--space-4);
  }
  section {
    display: grid;
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    color: var(--ink);
    font: var(--text-label-12);
  }
  /* The file input is the label's own control: the label looks like a button and takes the taps, the input stays
     reachable by keyboard and by its name. */
  .pick {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: start;
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .pick:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .pick input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .name {
    margin: 0;
    color: var(--muted);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .size {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  /* The picture at its own shape, as wide as the dialog allows and never taller than a third of the window, with the
     tile grid drawn over it as hairlines one tile apart. Pixel art stays sharp. */
  .preview {
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--edge-sm);
    background: var(--charcoal);
  }
  .preview img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, var(--focus) 1px, transparent 1px),
      linear-gradient(to bottom, var(--focus) 1px, transparent 1px);
    background-size: var(--cell-w) var(--cell-h);
    opacity: 0.7;
  }
  .summary,
  .problem,
  .trouble {
    margin: 0;
    font: var(--text-body-13);
  }
  .summary {
    color: var(--ink);
  }
  .problem,
  .trouble {
    color: var(--warn);
  }
</style>
