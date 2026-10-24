<!--
  Where an opened document goes until the Level view replaces this file (ED2D.4c4; plan ED2D.4c2a, decision 10). It
  says what is open and by which profile, offers Back, and shows how the document stands on saving, so Open and New
  end somewhere real and Back has something to return from. It edits nothing, so leaving it loses nothing. Focus moves
  to the heading on arrival: the page changed, and a keyboard or a screen reader should start on the new one.
-->
<script lang="ts">
import { EditorShell, StatusLine, ToastRegion } from '@mcthaydt/automata-editor-kit'
import type { SaveState, ToastStore } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onMount } from 'svelte'
import Button from './controls/Button.svelte'
import type { OpenOutcome } from './editor-app'

interface Props {
  geometry: GeometryState
  opened: Extract<OpenOutcome, { status: 'opened' }>
  toasts: ToastStore
  onback: () => void
}

const { geometry, opened, toasts, onback }: Props = $props()
const session = $derived(opened.document.session)

// svelte-ignore state_referenced_locally
let save = $state<SaveState>(session.status)
$effect(() => {
  save = session.status
  return session.subscribe(() => {
    save = session.status
  })
})

let heading = $state<HTMLElement>()
onMount(() => heading?.focus())
</script>

<EditorShell {geometry} testId="document-frame">
  {#snippet topbar()}
    <Button onclick={onback}>Back</Button>
    <h1 tabindex="-1" bind:this={heading}>{opened.document.path}</h1>
    <span class="kind">{opened.document.profile.label}</span>
  {/snippet}

  {#snippet canvas()}
    <p class="placeholder">The editing views arrive with ED2D.4c4. This file is open and safe.</p>
  {/snippet}

  {#snippet status()}
    <StatusLine {save} />
  {/snippet}

  {#snippet sheets()}
    <ToastRegion {toasts} />
  {/snippet}
</EditorShell>

<style>
  h1 {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--text-title-15);
  }
  h1:focus {
    outline: none;
  }
  .kind {
    color: var(--color-text-dim);
    font: var(--text-label-12);
    white-space: nowrap;
  }
  .placeholder {
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
