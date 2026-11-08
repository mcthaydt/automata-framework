<!--
  The left of Home: where projects come from and how they are kept. One
  source today, this workspace, with the editor's own ways to bring files in under it (the `importers` snippet: the 2D
  editor imports files, the 3D editor a folder or a zip); the folder source arrives with the kit's folder store.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { Workspace } from '../storage/workspace'
import { storageNotes, workspaceSubtitle } from './project-browse'

interface Props {
  workspace: Workspace
  /** How many projects the workspace lists. */
  count: number
  /** The import controls, under the workspace row. */
  importers: Snippet
}

const { workspace, count, importers }: Props = $props()
const uid = $props.id()
</script>

<div class="panel">
  <section aria-labelledby={`${uid}-sources`}>
    <h2 id={`${uid}-sources`}>Open from</h2>
    <div class="source" aria-current="true">
      <span class="name">This workspace</span>
      <span class="subtitle">{workspaceSubtitle(workspace, count)}</span>
    </div>
    {@render importers()}
  </section>

  <section class="storage" aria-labelledby={`${uid}-storage`}>
    <h2 id={`${uid}-storage`}>Storage</h2>
    <ul>
      {#each storageNotes(workspace) as note (note.text)}
        <li data-tone={note.tone}>
          {#if note.tone !== 'info'}<span class="dot" aria-hidden="true"></span>{/if}
          {note.text}
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .storage {
    margin-top: auto;
    padding-top: var(--space-3);
    border-top: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    padding: 0 var(--space-2);
    color: var(--muted);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .source {
    display: flex;
    flex-direction: column;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--cobalt) 60%, transparent);
    border-radius: var(--edge-sm);
    background: color-mix(in srgb, var(--cobalt) 12%, transparent);
  }
  .name {
    font: var(--text-body-13-medium);
  }
  .subtitle {
    color: var(--muted);
    font: var(--text-mono-11);
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0 var(--space-2);
    list-style: none;
    font: var(--text-body-13);
  }
  li {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  li[data-tone='info'] {
    color: var(--muted);
    font: var(--text-label-12);
  }
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
  }
  li[data-tone='warn'] .dot {
    background: var(--warn);
  }
</style>
