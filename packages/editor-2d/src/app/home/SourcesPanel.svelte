<!--
  The left of Home (plan ED2D.4c2a): where projects come from and how they are kept. One source today, this
  workspace; the folder source arrives with the kit's folder store (ED2D.8). Import is a `<label>` around a file input
  that is transparent and covers the label, so it stays focusable and a screen reader finds it, and a tap opens the
  system picker with no scripted click (iPad Safari allows only that), and the input is cleared afterwards so choosing the same file again
  still fires a change. Nothing is filtered by extension: the picker on a tablet greys out files it does not know the
  type of, and the app decides what it keeps.
-->
<script lang="ts">
import type { Workspace } from '@mcthaydt/automata-editor-kit/core'
import { storageNotes, workspaceSubtitle } from './home-model'

interface Props {
  workspace: Workspace
  /** How many projects the workspace lists. */
  count: number
  /** Another action is running: Import waits. */
  busy: boolean
  onimport: (files: readonly { readonly name: string; readonly bytes: Uint8Array }[]) => void
}

const { workspace, count, busy, onimport }: Props = $props()
const uid = $props.id()

async function picked(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
  const input = event.currentTarget
  const chosen = [...(input.files ?? [])]
  // Read first, then clear: clearing empties `input.files`.
  const files = await Promise.all(
    chosen.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })),
  )
  input.value = ''
  if (files.length > 0) onimport(files)
}
</script>

<div class="panel">
  <section aria-labelledby={`${uid}-sources`}>
    <h2 id={`${uid}-sources`}>Open from</h2>
    <div class="source" aria-current="true">
      <span class="name">This workspace</span>
      <span class="subtitle">{workspaceSubtitle(workspace, count)}</span>
    </div>
    <label class="import" aria-disabled={busy}>
      Import files…
      <input type="file" multiple disabled={busy} onchange={picked} />
    </label>
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
    border-top: 1px solid var(--color-border-default);
  }
  h2 {
    margin: 0;
    padding: 0 var(--space-2);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .source {
    display: flex;
    flex-direction: column;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-accent-default) 60%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-accent-default) 12%, transparent);
  }
  .name {
    font: var(--text-body-13-medium);
  }
  .subtitle {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .import {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .import[aria-disabled='true'] {
    opacity: 0.45;
    cursor: default;
  }
  .import:has(input:focus-visible) {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  /* Transparent and over the whole label: pressing anywhere on Import presses the input itself, which stays focusable,
     announced and a full-size target. */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  input:disabled {
    cursor: default;
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
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-state-ok);
  }
  li[data-tone='warn'] .dot {
    background: var(--color-state-warn);
  }
</style>
