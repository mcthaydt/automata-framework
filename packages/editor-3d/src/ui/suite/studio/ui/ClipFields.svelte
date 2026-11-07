<!--
  The inspector's Animate tab (EDS.9c; editor suite spec §6.2): the chosen clip's length, loop, mode and the body groups
  it owns; the chosen key's time, pose and ease; and the clip's markers and cues, each added at the playhead. Every
  change is one step; a time that does not fit (a key past its neighbour, a marker outside the clip) is refused in
  words under the fields.
-->
<script lang="ts">
import { type Ease, MASK_GROUPS } from '@automata/3d/figures'
import { Button, Chips, Picker, Segmented, Stepper } from '@automata/editor/kit'
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
const entry = $derived(content.clips.find((each) => each.id === $viewState.clip))
const clip = $derived(entry?.value)
const key = $derived($viewState.key === undefined ? undefined : clip?.keys[$viewState.key])
const poses = $derived(content.poses.map((each) => ({ id: each.id, label: each.id })))

const NAMED = ['linear', 'step', 'in', 'out', 'inOut'] as const
const easeName = (ease: Ease | undefined): string =>
  ease === undefined ? 'linear' : Array.isArray(ease) ? 'bezier' : (ease as string)
const easeOptions = [...NAMED.map((id) => ({ id, label: id })), { id: 'bezier', label: 'Bézier' }]

function pickEase(id: string): void {
  if ($viewState.key === undefined) return
  void controller.setKeyEase(
    $viewState.key,
    id === 'linear' ? undefined : id === 'bezier' ? [0.4, 0, 0.2, 1] : (id as Ease),
  )
}

function bezier(index: number, value: number): void {
  if ($viewState.key === undefined || !Array.isArray(key?.ease)) return
  const next = [...key.ease] as [number, number, number, number]
  next[index] = value
  void controller.setKeyEase($viewState.key, next)
}

let markerName = $state('contact')
let cueName = $state('')
const set = (event: { phase: string }): boolean => event.phase === 'set' || event.phase === 'commit'
</script>

{#if clip === undefined}
  <p class="none">{entry === undefined ? 'No clip is chosen.' : 'This clip has a problem; see the panel.'}</p>
{:else}
  <div class="clip" data-testid="studio-clip">
    <h2>{entry?.id}</h2>
    <Stepper label="Length" value={clip.length} min={0.05} step={0.05} unit="s" onedit={(event) => set(event) && void controller.setClipLength(event.value)} />
    <div class="labelled">
      <span class="name">Loop</span>
      <Segmented
        label="Loop"
        value={clip.loop}
        options={[{ id: 'once', label: 'Once' }, { id: 'loop', label: 'Loop' }, { id: 'pingpong', label: 'Ping-pong' }, { id: 'hold', label: 'Hold' }]}
        onedit={(event) => void controller.setClipLoop(event.value as typeof clip.loop)}
      />
    </div>
    <div class="labelled">
      <span class="name">Mode</span>
      <Segmented
        label="Mode"
        value={clip.mode ?? 'override'}
        options={[{ id: 'override', label: 'Override' }, { id: 'additive', label: 'Additive' }]}
        onedit={(event) => void controller.setClipMode(event.value === 'override' ? undefined : (event.value as 'additive'))}
      />
    </div>
    <Chips
      label="Body groups it owns"
      mode="multi"
      items={MASK_GROUPS.map((group) => ({ id: group, label: group }))}
      selected={clip.mask}
      onedit={(event) => void controller.setClipMask(event.value as never)}
    />

    <h3>Key</h3>
    {#if key === undefined || $viewState.key === undefined}
      <p class="hint">Tap a key on the timeline.</p>
    {:else}
      <Stepper
        label="Key time"
        value={key.t}
        min={0}
        max={clip.length}
        step={0.01}
        unit="s"
        onedit={(event) => set(event) && void controller.moveKey($viewState.key ?? 0, event.value)}
      />
      <Picker
        label="Key pose"
        value={typeof key.pose === 'string' ? key.pose : undefined}
        placeholder="Written in the file"
        options={poses}
        onpick={(id) => void controller.setKeyPose($viewState.key ?? 0, id)}
      />
      <Picker label="Ease into this key" value={easeName(key.ease)} options={easeOptions} onpick={pickEase} />
      {#if Array.isArray(key.ease)}
        {#each ['x1', 'y1', 'x2', 'y2'] as label, index (label)}
          <Stepper
            label={`Bézier ${label}`}
            value={key.ease[index] ?? 0}
            step={0.05}
            onedit={(event) => set(event) && bezier(index, event.value)}
          />
        {/each}
      {/if}
      <Button variant="danger" onclick={() => void controller.removeKey($viewState.key ?? 0)}>Remove key</Button>
    {/if}

    <h3>Markers</h3>
    <ul>
      {#each Object.entries(clip.markers ?? {}) as [name, t] (name)}
        <li>
          <span>{name} · {t} s</span>
          <Button aria-label={`Remove marker ${name}`} onclick={() => void controller.removeMarker(name)}>Remove</Button>
        </li>
      {/each}
    </ul>
    <label>
      <span>Marker name</span>
      <input bind:value={markerName} autocomplete="off" spellcheck="false" />
    </label>
    <Button onclick={() => void controller.setMarker(markerName, $viewState.playhead)}>Mark the playhead</Button>

    <h3>Cues</h3>
    <ul>
      {#each clip.cues ?? [] as cue, index (index)}
        <li>
          <span>{cue.id} · {cue.t} s</span>
          <Button aria-label={`Remove cue ${cue.id}`} onclick={() => void controller.removeCue(index)}>Remove</Button>
        </li>
      {/each}
    </ul>
    <label>
      <span>Cue name</span>
      <input bind:value={cueName} autocomplete="off" spellcheck="false" />
    </label>
    <Button onclick={() => void controller.addCue($viewState.playhead, cueName)}>Add cue at the playhead</Button>
  </div>
{/if}

<style>
  .clip {
    display: grid;
    gap: var(--space-3);
  }
  h2,
  h3 {
    margin: 0;
    font: var(--text-title-15);
  }
  h3 {
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }
  label {
    display: grid;
    gap: var(--space-1);
  }
  input {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border, #3a3f48);
    border-radius: var(--radius-control, 8px);
    background: transparent;
    color: inherit;
    font: inherit;
  }
  .hint,
  .none {
    margin: 0;
    color: var(--color-text-dim);
  }
  .labelled {
    display: grid;
    gap: var(--space-1);
  }
  .name {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
</style>
