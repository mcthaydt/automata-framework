<!--
  The Studio's panel (EDS.9a to EDS.9c; editor suite spec §6.2): the game's figures, poses and clips as lists to choose
  from, "New pose" and "New clip" (a copy of the chosen pose, and a clip of two keys onto it), and the files the
  figures schemas refused, with their sentences. Choosing a file is the view's state; the files are the content's.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
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

let adding = $state<'pose' | 'clip' | undefined>()
let name = $state('')

async function add(): Promise<void> {
  const result = adding === 'pose' ? await controller.addPose(name) : await controller.addClip(name)
  if (result.ok) {
    adding = undefined
    name = ''
  }
}
</script>

<div class="panel" data-testid="studio-panel">
  {#each [{ kind: 'figure', title: 'Figures', entries: content.figures, current: $viewState.figure }, { kind: 'pose', title: 'Poses', entries: content.poses, current: $viewState.pose }, { kind: 'clip', title: 'Clips', entries: content.clips, current: $viewState.clip }] as const as group (group.kind)}
    <section aria-label={group.title}>
      <h2>{group.title}</h2>
      <ul>
        {#each group.entries as entry (entry.path)}
          <li>
            <button
              type="button"
              aria-pressed={entry.id === group.current}
              aria-label={`${entry.id}${entry.value === undefined ? ' (has a problem)' : ''}`}
              onclick={() => controller.view.select(group.kind, entry.id)}
            >
              <span>{entry.id}</span>
              {#if entry.value === undefined}<span class="flag" aria-hidden="true">!</span>{/if}
            </button>
          </li>
        {:else}
          <li class="none">None yet</li>
        {/each}
      </ul>
      {#if group.kind !== 'figure'}
        {#if adding === group.kind}
          <form
            onsubmit={(event) => {
              event.preventDefault()
              void add()
            }}
          >
            <label>
              <span>{group.kind === 'pose' ? 'Pose id' : 'Clip id'}</span>
              <input bind:value={name} autocomplete="off" autocapitalize="none" spellcheck="false" />
            </label>
            <Button variant="primary" onclick={() => void add()}>Add</Button>
            <Button onclick={() => (adding = undefined)}>Cancel</Button>
          </form>
        {:else}
          <Button onclick={() => (adding = group.kind === 'pose' ? 'pose' : 'clip')}>
            {group.kind === 'pose' ? 'New pose' : 'New clip'}
          </Button>
        {/if}
      {/if}
    </section>
  {/each}
  {#if content.problems.length > 0}
    <section aria-label="Problems" class="problems">
      <h2>Problems</h2>
      <ul>
        {#each content.problems as problem, index (index)}
          <li><strong>{problem.path}</strong> {problem.message}</li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-3);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0 0 var(--space-2);
    padding: 0;
    list-style: none;
  }
  li button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-3);
    align-items: center;
    border: 1px solid transparent;
    border-radius: var(--radius-control, 8px);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  li button[aria-pressed='true'] {
    border-color: var(--color-accent, #d9a441);
    background: var(--color-accent-soft, rgb(217 164 65 / 0.14));
  }
  .flag {
    color: var(--color-state-error, #e5534b);
    font-weight: 700;
  }
  .none {
    color: var(--color-text-dim);
  }
  form {
    display: grid;
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
    background: var(--color-surface-sunk, transparent);
    color: inherit;
    font: inherit;
  }
  .problems li {
    color: var(--color-state-error, #e5534b);
  }
  .problems strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }
</style>
