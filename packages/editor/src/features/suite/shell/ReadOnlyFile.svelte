<!--
  A file shown read only: the file of an editor this build does not have (EDS-l), or one the
  list's rules never let an editor write. The text is a scroll region of its own; nothing in it can be typed into.
-->
<script lang="ts">
import type { SuiteWorkspace, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import Button from '../../../shared/kit/widgets/Button.svelte'

interface Props {
  file: WorkspaceFile
  workspace: SuiteWorkspace
  onback: () => void
}

const { file, workspace, onback }: Props = $props()

const text = $derived(workspace.read(file.path))
</script>

<section class="source" aria-labelledby="read-only-path">
  <header>
    <Button onclick={onback}>Back to Home</Button>
    <h2 id="read-only-path">{file.path}</h2>
    <span class="badge">Read only</span>
  </header>
  {#await text}
    <p class="note">Reading…</p>
  {:then found}
    {#if found === undefined}
      <p class="note">This file is not in the game any more.</p>
    {:else}
      <!-- A scroll region takes the focus so the keyboard can scroll it (WCAG 2.1.1). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre data-selectable tabindex="0" aria-label="File text">{found.text}</pre>
    {/if}
  {:catch}
    <p class="note">This file could not be read.</p>
  {/await}
</section>

<style>
  .source {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
    height: 100%;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    font: var(--text-mono-12);
  }
  .badge {
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
  }
  pre {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: var(--space-3);
    overflow: auto;
    border-radius: var(--edge);
    background: var(--color-bg-field);
    font: var(--text-mono-12);
    touch-action: pan-x pan-y;
  }
</style>
