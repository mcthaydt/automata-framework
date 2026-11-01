<!--
  The Studio's timeline (EDS.9c; editor suite spec §6.2), in the dock: Play and Pause, the playhead as a slider, Add key at
  the playhead with the chosen pose, and the clip's keys, markers and cues on one track. A key is a 44 px target: a tap
  chooses it and moves the playhead to it, a drag along the track retimes it (one step when it is let go), and a key
  between its neighbours is the only place it can land.
-->
<script lang="ts">
import { Button, Slider } from '@mcthaydt/automata-editor-kit'
import type { StudioController } from '../studio-controller'

const { controller }: { controller: StudioController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const viewState = controller.view.state
const content = $derived.by(() => {
  void $revision
  return controller.content()
})
const clip = $derived(content.clips.find((entry) => entry.id === $viewState.clip)?.value)
const length = $derived(clip?.length ?? 1)

let track = $state<HTMLElement>()
let drag = $state<{ index: number; t: number } | undefined>()

const at = (t: number): string => `${Math.min(100, Math.max(0, (t / length) * 100))}%`

/** Seconds under a pointer, to the hundredth. */
function timeOf(event: PointerEvent): number {
  const box = track?.getBoundingClientRect()
  if (box === undefined || box.width === 0) return 0
  return (
    Math.round(Math.min(length, Math.max(0, ((event.clientX - box.left) / box.width) * length)) * 100) / 100
  )
}

function down(event: PointerEvent, index: number, t: number): void {
  capture(event)
  controller.view.selectKey(index)
  controller.view.setPlayhead(t)
  drag = { index, t }
}
function move(event: PointerEvent): void {
  if (drag !== undefined) drag = { ...drag, t: timeOf(event) }
}
function up(event: PointerEvent): void {
  const done = drag
  drag = undefined
  if (done === undefined || event.type === 'pointercancel') return
  const key = clip?.keys[done.index]
  if (key !== undefined && done.t !== key.t) void controller.moveKey(done.index, done.t)
}

/** Capture is best effort: a synthetic pointer, or one that already ended, has nothing to capture. */
function capture(event: PointerEvent): void {
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Nothing to capture.
  }
}
</script>

<section class="timeline" aria-label="Timeline" data-testid="studio-timeline">
  <div class="bar">
    <Button
      variant="primary"
      aria-label={$viewState.playing ? 'Pause' : 'Play'}
      onclick={() => controller.view.setPlaying(!$viewState.playing)}
    >
      {$viewState.playing ? 'Pause' : 'Play'}
    </Button>
    <Slider
      label="Playhead"
      value={$viewState.playhead}
      min={0}
      max={length}
      step={0.01}
      unit="s"
      onedit={(event) => controller.view.setPlayhead(event.value)}
    />
    <Button onclick={() => void controller.addKeyAtPlayhead()}>Add key</Button>
  </div>
  {#if clip === undefined}
    <p class="none">No clip is chosen.</p>
  {:else}
    <div class="track" bind:this={track} data-testid="studio-track">
      <div class="playhead" style:left={at($viewState.playhead)} aria-hidden="true"></div>
      {#each clip.keys as key, index (index)}
        {@const t = drag?.index === index ? drag.t : key.t}
        <button
          type="button"
          class="key"
          class:chosen={$viewState.key === index}
          style:left={at(t)}
          aria-label={`Key ${index} at ${t} seconds, ${typeof key.pose === 'string' ? key.pose : 'inline pose'}`}
          aria-pressed={$viewState.key === index}
          onpointerdown={(event) => down(event, index, key.t)}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
        ></button>
      {/each}
      {#each Object.entries(clip.markers ?? {}) as [name, t] (name)}
        <span class="marker" style:left={at(t)} title={name}>{name}</span>
      {/each}
      {#each clip.cues ?? [] as cue, index (index)}
        <span class="cue" style:left={at(cue.t)} title={cue.id}>{cue.id}</span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .timeline {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .bar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-3);
    align-items: center;
  }
  .track {
    position: relative;
    /* The kit's dock is 148 px: the bar, then keys (44 px) and one row of marker and cue names fit without scrolling. */
    height: 62px;
    margin: 0 22px;
    border-top: 2px solid var(--color-border, #3a3f48);
    touch-action: none;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-accent, #d9a441);
  }
  .key {
    position: absolute;
    top: 0;
    width: 44px;
    height: 44px;
    margin-left: -22px;
    padding: 0;
    border: 2px solid var(--color-accent, #d9a441);
    border-radius: 8px;
    background: var(--color-surface-base, #14161a);
    touch-action: none;
  }
  .key.chosen {
    background: var(--color-accent, #d9a441);
  }
  .marker,
  .cue {
    position: absolute;
    top: 46px;
    transform: translateX(-50%);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    white-space: nowrap;
  }
  .cue {
    /* Beside the markers' row, in the accent, so the two read apart. */
    color: var(--color-accent, #d9a441);
  }
  .none {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
