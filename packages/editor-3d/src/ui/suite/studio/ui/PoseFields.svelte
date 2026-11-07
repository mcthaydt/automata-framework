<!--
  The inspector's Pose tab (EDS.9b; editor suite spec §6.2): the chosen handle's target as three numbers (metres in the
  figure's space; a turn in degrees for the chest and the head), whether the solve reached it and by how much it fell
  short, and Remove. Dragging a handle on the stage and typing here are the same edit.
-->
<script lang="ts">
import { Button, Stepper } from '@automata/editor/kit'
import type { StudioController } from '../studio-controller'
import { handlesOf } from '../studio-view'

const { controller }: { controller: StudioController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const viewState = controller.view.state
const content = $derived.by(() => {
  void $revision
  return controller.content()
})
const pose = $derived(content.poses.find((entry) => entry.id === $viewState.pose))
const handles = $derived(handlesOf(content, { ...$viewState, mode: 'pose' }))
const handle = $derived(handles.find((each) => each.id === $viewState.handle))
const target = $derived(
  $viewState.handle === undefined ? undefined : pose?.value?.effectors[$viewState.handle],
)
const turnOnly = $derived($viewState.handle === 'chest' || $viewState.handle === 'head')
const axes = ['x', 'y', 'z'] as const

function numbers(): readonly [number, number, number] {
  if (handle === undefined) return [0, 0, 0]
  const own = turnOnly
    ? (target as { rot?: readonly number[] } | undefined)?.rot
    : (target as { pos?: readonly number[] } | undefined)?.pos
  return [
    own?.[0] ?? (turnOnly ? 0 : handle.position[0]),
    own?.[1] ?? (turnOnly ? 0 : handle.position[1]),
    own?.[2] ?? (turnOnly ? 0 : handle.position[2]),
  ]
}

function change(axis: number, value: number): void {
  const id = $viewState.handle
  const entry = pose
  if (id === undefined || entry?.value === undefined) return
  const next = [...numbers()] as [number, number, number]
  next[axis] = value
  if (turnOnly) void controller.setHandleTurn(id, next)
  else void controller.dropHandle(id, next)
}

const short = (error: number, degrees: boolean): string =>
  degrees ? `${error.toFixed(1)}°` : `${(error * 100).toFixed(1)} cm`
</script>

<div class="pose" data-testid="studio-pose">
  <h2>{pose?.id ?? 'No pose'}</h2>
  {#if handle === undefined}
    <p class="hint">Tap a handle on the stage to move it.</p>
  {:else}
    <h3>{handle.id}{handle.set ? '' : ' (not set by this pose)'}</h3>
    {#each axes as axis, index (axis)}
      <Stepper
        label={`${handle.id} ${turnOnly ? 'turn ' : ''}${axis}`}
        value={numbers()[index] ?? 0}
        step={turnOnly ? 1 : 0.01}
        unit={turnOnly ? '°' : 'm'}
        onedit={(event) => (event.phase === 'set' || event.phase === 'commit') && change(index, event.value)}
      />
    {/each}
    {#if !handle.reached}
      <p class="amber" role="status">Out of reach by {short(handle.error, turnOnly)}.</p>
    {/if}
    {#if handle.set && pose?.value !== undefined}
      <Button onclick={() => void controller.removeHandle(handle.id)}>Remove {handle.id}</Button>
    {/if}
  {/if}
</div>

<style>
  .pose {
    display: grid;
    gap: var(--space-3);
  }
  h2,
  h3 {
    margin: 0;
    font: var(--text-title-15);
  }
  .hint {
    margin: 0;
    color: var(--color-text-dim);
  }
  .amber {
    margin: 0;
    color: var(--color-state-warn, #e0a030);
  }
</style>
