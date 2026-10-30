<!--
  What a shell region shows when its content throws (kit spec §6): a short message, the details as read-only text and a
  Copy details action. `EditorShell` renders it from each region's error boundary, so only that region is replaced and
  the others stay usable.

  Spec §6 names no fallback for Copy details, so the details are always on screen in a selectable box; when the
  clipboard is missing or refuses, the action selects that text for the system's own Copy and says so.

  `bar` is one row, for the top bar, the status bar and the tab bar; `block` fills a panel, inspector, dock or canvas,
  and in a column as narrow as the wide rail (56 px) it tightens its gutter and the button reads "Copy", keeping its
  44 px target and its accessible name.
-->
<script lang="ts">
import { REGION_LABEL, regionErrorDetails, type SnippetRegion } from './region-error'

interface Props {
  region: SnippetRegion
  error: unknown
  layout: 'bar' | 'block'
}

const { region, error, layout }: Props = $props()

const details = $derived(regionErrorDetails(region, error))
let note = $state('')
let detailsBox: HTMLTextAreaElement | undefined = $state()

async function copyDetails(): Promise<void> {
  // A second Copy starts from a blank note, so an old "Copied" never vouches for this one.
  note = ''
  try {
    // A missing clipboard throws here too, and takes the same way out as a refused one.
    await navigator.clipboard.writeText(details)
    note = 'Copied'
  } catch {
    detailsBox?.focus()
    detailsBox?.select()
    // iOS Safari often ignores select() on a read-only box; an explicit range selects it there too.
    detailsBox?.setSelectionRange(0, details.length)
    note = 'Copy is not available here: the details are selected.'
  }
}

// The note is about the last Copy; once focus leaves the panel it is stale. Moving to the details box keeps it.
function clearNoteOnLeave(event: FocusEvent): void {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) note = ''
}
</script>

<div class="region-error" data-region-error={region} data-layout={layout}>
  <!-- The action comes before the details box, so it is in view even in a region as short as the dock. -->
  <div class="inner" onfocusout={clearNoteOnLeave}>
    <!-- Only the message is the alert, so it is announced once; the note is its own polite status. -->
    <p class="message" role="alert">The {REGION_LABEL[region]} stopped working.</p>
    <button type="button" class="copy" aria-label="Copy details" onclick={copyDetails}
      >Copy<span class="long">{' details'}</span></button
    >
    <span class="note" role="status">{note}</span>
    <textarea
      bind:this={detailsBox}
      class="details"
      aria-label="Error details"
      readonly
      rows={layout === 'bar' ? 1 : 6}
      value={details}
    ></textarea>
  </div>
</div>

<style>
  .region-error {
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }

  .region-error[data-layout='block'] {
    flex: 1;
    min-height: 0;
    overflow: auto;
    container-type: inline-size;
  }

  .region-error[data-layout='bar'] {
    flex: 1 1 auto;
    align-self: stretch;
  }

  .inner {
    box-sizing: border-box;
    flex: 1;
    display: flex;
    gap: var(--space-2);
    min-width: 0;
  }

  /* The message, Copy details and the note share a line while they fit (a half-height sheet on a phone in landscape
     has about 120 px), and the details box takes the full width beneath them. */
  [data-layout='block'] .inner {
    flex-wrap: wrap;
    align-items: center;
    align-content: flex-start;
    padding: var(--space-3);
  }

  [data-layout='block'] .message {
    flex: 1 1 auto;
  }

  [data-layout='block'] .details {
    flex: 1 1 100%;
  }

  [data-layout='bar'] .inner {
    align-items: center;
  }

  .message {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--color-state-bad);
    font: var(--text-label-12);
  }

  [data-layout='bar'] .message {
    flex: none;
    white-space: nowrap;
  }

  /* The details box takes touches (select, scroll), so it is a 44 px target like the button. */
  .details {
    box-sizing: border-box;
    flex: none;
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    resize: none;
    padding: var(--space-1) var(--space-2);
    font: var(--text-mono-11);
    color: var(--color-text-dim);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    user-select: text;
  }

  [data-layout='bar'] .details {
    flex: 1 1 0;
    height: var(--size-hit);
    white-space: nowrap;
  }

  .copy {
    flex: none;
    box-sizing: border-box;
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    font: var(--text-label-12);
    color: var(--color-text-primary);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .copy:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }

  @container (max-width: 120px) {
    [data-layout='block'] .inner {
      padding: var(--space-1);
    }

    .copy {
      padding: 0;
    }

    .long {
      display: none;
    }
  }

  .note {
    font: var(--text-label-12);
    color: var(--color-text-dim);
  }
</style>
