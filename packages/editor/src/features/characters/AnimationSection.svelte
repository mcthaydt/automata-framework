<!--
  A character's Animation section, in its details: a picture cut into frames, and clips tapped together from them. The
  game plays the first clip until code picks another by name. "Add picture" takes a picture from the person's device and
  writes it into the game; the frame size says how it is cut; the strip shows every frame, numbered, and tapping one adds
  it to the chosen clip; the chosen clip plays beside its row. There is no painting here: frames are drawn in any paint
  app. Every edit is one step the session puts in one undo step, and a refused edit shows its sentence.
-->
<script lang="ts">
import type { ContentAnimation } from '@automata/content/level-2d'
import { onDestroy } from 'svelte'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import Button from '../../shared/kit/widgets/Button.svelte'
import type { EditEvent } from '../../shared/kit/widgets/edit-event'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import type { FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { Size } from '../../shared/level-2d/model/project-types'
import { decodedSize, PICTURE_TYPES, writePicture } from '../../shared/pictures/pick-picture'
import {
  addClip,
  addFrame,
  animationModel,
  newAnimation,
  removeClip,
  removeLastFrame,
  renameClip,
  setFps,
  setFrameSize,
  setLoop,
} from './animation-model'

interface Props {
  animation: ContentAnimation | undefined
  /** The character's size: a new animation's frames start that big (or as big as the picture allows). */
  size: Size
  /** Where a picture is written; without it there is no Add picture. */
  files?: Pick<ProjectStore, 'list' | 'write'> | undefined
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
  /** The animation to keep (`undefined` takes it away), as one undo step. */
  onedit: (next: ContentAnimation | undefined) => FieldCommit
  measure?: ((bytes: Uint8Array) => Promise<Size | undefined>) | undefined
}

const { animation, size, files, read, objectUrls, onedit, measure = decodedSize }: Props = $props()

let chosen = $state<string | undefined>()
let trouble = $state<string | undefined>()
let imageSize = $state.raw<Size | undefined>()
let url = $state<string | undefined>()
let shown = $state(0)

const model = $derived(animationModel(animation, imageSize))
const clip = $derived(animation?.clips.find((each) => each.id === chosen) ?? animation?.clips[0])
const columns = $derived(
  animation === undefined || imageSize === undefined
    ? 1
    : Math.max(1, Math.floor(imageSize.w / animation.frame.w)),
)

// The picture's size and a URL to draw it from, each time the picture changes.
$effect(() => {
  const path = animation?.image
  imageSize = undefined
  if (path === undefined) return
  let made: string | undefined
  let current = true
  void read(path).then(async (bytes) => {
    if (!current || bytes === undefined) return
    imageSize = await measure(bytes)
    made = objectUrls?.create(bytes)
    if (current) url = made
  })
  return () => {
    current = false
    if (made !== undefined) objectUrls?.revoke(made)
    url = undefined
  }
})

// The chosen clip plays beside its row: its frames in turn at its speed (a clip that does not repeat stops on its last).
$effect(() => {
  const playing = clip
  shown = 0
  if (playing === undefined || playing.frames.length < 2) return
  let at = 0
  const timer = setInterval(() => {
    at += 1
    if (at >= playing.frames.length) {
      if (!playing.loop) return clearInterval(timer)
      at = 0
    }
    shown = at
  }, 1000 / playing.fps)
  return () => clearInterval(timer)
})

const run = (next: () => ContentAnimation | undefined): void => {
  try {
    const result = onedit(next())
    trouble = result.ok ? undefined : result.message
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    trouble = error.message
  }
}
const edit = (change: (animation: ContentAnimation) => ContentAnimation | undefined): void => {
  const current = animation
  if (current !== undefined) run(() => change(current))
}
const committed = (event: EditEvent<unknown>): boolean => event.phase === 'set' || event.phase === 'commit'

async function pick(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined || files === undefined) return
  trouble = undefined
  const bytes = new Uint8Array(await file.arrayBuffer())
  const measured = await measure(bytes)
  if (measured === undefined) {
    trouble = 'That file isn’t a picture we can read. Try a PNG, WebP or JPEG.'
    return
  }
  const written = await writePicture(files, { name: file.name, bytes })
  if (!written.ok) {
    trouble = written.message
    return
  }
  const frame = { w: Math.min(size.w, measured.w), h: Math.min(size.h, measured.h) }
  if (animation === undefined) run(() => newAnimation(written.path, frame))
  else edit((current) => ({ ...current, image: written.path }))
  input.value = ''
}

/** The CSS that shows frame `index` of the picture at the preview's own pixel size, scaled by `scale`. */
function frameStyle(index: number, scale: number): string {
  if (animation === undefined || url === undefined || imageSize === undefined) return ''
  const { w, h } = animation.frame
  const x = (index % columns) * w
  const y = Math.floor(index / columns) * h
  return `width:${w * scale}px;height:${h * scale}px;background:url(${url}) -${x * scale}px -${y * scale}px / ${imageSize.w * scale}px ${imageSize.h * scale}px no-repeat;image-rendering:pixelated`
}
</script>

<section class="animation" aria-label="Animation" data-testid="animation-section">
  <h3>Animation</h3>
  {#if animation === undefined}
    <p class="hint">Draw your frames in any paint app, then add the picture here.</p>
  {/if}
  {#if files !== undefined}
    <label class="add">
      <span class="button">{animation === undefined ? 'Add picture' : 'Change picture'}</span>
      <input type="file" accept={PICTURE_TYPES} aria-label="Choose a picture of frames" onchange={pick} />
    </label>
  {:else if animation === undefined}
    <p class="hint">This game can’t save pictures from here.</p>
  {/if}

  {#if animation !== undefined}
    <p class="picture">{animation.image}</p>
    <Stepper
      label="Frame width"
      value={animation.frame.w}
      min={1}
      integer
      onedit={(event) => committed(event) && edit((a) => setFrameSize(a, { ...a.frame, w: event.value }))}
    />
    <Stepper
      label="Frame height"
      value={animation.frame.h}
      min={1}
      integer
      onedit={(event) => committed(event) && edit((a) => setFrameSize(a, { ...a.frame, h: event.value }))}
    />
    <p class="count">
      {model.frames === 0 ? 'The picture is loading.' : `The picture has ${model.frames} frame${model.frames === 1 ? '' : 's'}.`}
    </p>

    <div class="strip" role="group" aria-label="Frames">
      {#each Array.from({ length: model.frames }, (_, index) => index) as index (index)}
        <button
          type="button"
          class="frame"
          aria-label={`Frame ${index}`}
          title={`Add frame ${index} to ${clip?.id ?? 'the clip'}`}
          onclick={() => clip !== undefined && edit((a) => addFrame(a, clip.id, index))}
        >
          <span class="cut" style={frameStyle(index, 2)}></span>
          <span class="number">{index}</span>
        </button>
      {/each}
    </div>

    <div class="clips" role="radiogroup" aria-label="Clips">
      {#each model.clips as row (row.id)}
        <div class="clip" class:chosen={row.id === clip?.id}>
          <button
            type="button"
            role="radio"
            class="pick"
            aria-checked={row.id === clip?.id}
            aria-label={`Clip ${row.id}`}
            onclick={() => (chosen = row.id)}
          >
            {row.id}
          </button>
          <label class="name">
            <span>Name</span>
            <input
              value={row.id}
              aria-label={`Name of clip ${row.id}`}
              onchange={(event) => {
                const next = (event.currentTarget as HTMLInputElement).value
                edit((a) => renameClip(a, row.id, next))
                chosen = next.trim()
              }}
            />
          </label>
          <p class="frames" aria-label={`Frames of ${row.id}`}>Frames: {row.frames.join(', ')}</p>
          {#if row.problem !== undefined}<p class="problem" role="alert">{row.problem}</p>{/if}
          <Stepper
            label="Speed"
            value={row.fps}
            min={1}
            max={60}
            integer
            unit="a second"
            onedit={(event) => committed(event) && edit((a) => setFps(a, row.id, event.value))}
          />
          <button
            type="button"
            role="switch"
            class="toggle"
            aria-checked={row.loop}
            onclick={() => edit((a) => setLoop(a, row.id, !row.loop))}>Repeat</button
          >
          <div class="actions">
            <Button onclick={() => edit((a) => removeLastFrame(a, row.id))}>Take the last frame back</Button>
            <Button variant="danger" onclick={() => edit((a) => removeClip(a, row.id))}>Remove {row.id}</Button>
          </div>
        </div>
      {/each}
    </div>
    <Button onclick={() => edit((a) => addClip(a))}>Add a clip</Button>

    {#if clip !== undefined}
      <div class="preview" role="img" aria-label={`${clip.id} playing`}>
        <span class="cut" style={frameStyle(clip.frames[shown] ?? 0, 4)}></span>
      </div>
    {/if}
  {/if}
  {#if trouble !== undefined}<p class="message" role="alert">{trouble}</p>{/if}
</section>

<style>
  .animation {
    display: grid;
    gap: var(--space-3);
  }
  h3 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  p {
    margin: 0;
    font: var(--text-body-13);
  }
  .hint,
  .count,
  .picture {
    color: var(--color-text-dim);
  }
  .add {
    position: relative;
    display: inline-grid;
  }
  .add .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-body-13-medium);
  }
  /* The file input covers its own label so the whole button is the target. */
  .add input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  /* The frames scroll inside their own strip, never the page. */
  .strip {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    overscroll-behavior: contain;
    padding-bottom: var(--space-1);
  }
  .frame {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    flex: none;
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: var(--space-1);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .cut {
    display: block;
  }
  .clips {
    display: grid;
    gap: var(--space-3);
  }
  .clip {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
  }
  .clip.chosen {
    border-color: var(--color-accent, currentColor);
  }
  .pick,
  .toggle {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .toggle[aria-checked='true'],
  .pick[aria-checked='true'] {
    background: var(--color-bg-selected, var(--color-bg-field));
  }
  .name {
    display: grid;
    gap: var(--space-1);
    font: var(--text-label-12);
    color: var(--color-text-dim);
  }
  .name input {
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .preview {
    display: grid;
    place-items: center;
    padding: var(--space-3);
    background: var(--color-bg-field);
    border-radius: var(--edge-sm);
    overflow: hidden;
  }
  .problem,
  .message {
    color: var(--color-state-bad);
  }
</style>
