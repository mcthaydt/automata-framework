<!--
  The pill that floats over an editor's stage: one row of controls, centred at the stage's top or foot
  (`at`), or, in the compact layout, a dock: a plain bar across the stage's foot, under the thumb (the approved
  mockup's tool dock). The Level view's tools live in one; Map, Tiles and
  Characters put the buttons that open their list and their details in one, so every view has the same frame.

  It is a sibling of the stage's surface, never inside it, so a press on it never reaches the stage's gestures; the
  host gives the stage `position: relative`. It is never wider than the stage less a margin each side. If a narrow
  stage still cannot hold it, it scrolls sideways (a declared scroll region) rather than shrinking a control under
  44 px, and shows no scroll bar: macOS draws an overlay bar along a scrolling row's bottom edge and WebKit hit-tests
  it (about 15 px; #272), which would take a control's lower taps.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  /** The toolbar's accessible name ("Tools", "Map controls"). */
  label: string
  /** Where the pill floats: the stage's top or foot, or docked across the foot (the compact layout). */
  at?: 'top' | 'bottom' | 'dock'
  testId?: string | undefined
  children: Snippet
}

const { label, at = 'bottom', testId, children }: Props = $props()
</script>

<div
  class="stage-pill"
  role="toolbar"
  aria-label={label}
  data-floating="true"
  data-at={at}
  data-testid={testId}
  data-scroll-region="both"
>
  {@render children()}
</div>

<style>
  .stage-pill {
    position: absolute;
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0;
    box-sizing: border-box;
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
  }
  .stage-pill[data-at='top'] {
    top: var(--space-3);
    bottom: auto;
  }
  /* The dock: a bar across the stage's foot with square corners, its controls spread so each thumb reaches one. */
  .stage-pill[data-at='dock'] {
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    max-width: none;
    justify-content: space-around;
    border-width: 1px 0 0;
    border-radius: 0;
  }
  .stage-pill[data-at='dock'] :global(.segmented) {
    flex: 1 1 auto;
    justify-content: space-around;
  }
  /* A sheet rises from above the dock, never over it, so the button that opened it (Layers, Details) still closes it and
     the Map's Fit stays in reach. The dock's height: a target, its padding and its top edge. */
  :global(.shell[data-mode='compact']:has(.stage-pill[data-at='dock']) [data-presentation='sheet']) {
    margin-bottom: calc(var(--size-hit) + 2 * var(--space-1) + 1px);
    max-height: calc(100% - var(--size-hit) - 2 * var(--space-1) - 1px);
  }
  /* On a phone a sheet rises from the foot: a floating pill moves to the top while one is open. */
  :global(.shell[data-mode='compact']:has(:is([data-region='panel'], [data-region='inspector'])[data-open='true']))
    .stage-pill[data-at='bottom'] {
    top: var(--space-3);
    bottom: auto;
  }
  .stage-pill::-webkit-scrollbar {
    display: none;
  }
  /* Each item keeps its own width, so the pill scrolls instead of squeezing a control under its neighbour. */
  .stage-pill > :global(*) {
    flex: 0 0 auto;
  }
  /* The pill is the frame, so a segmented control inside it draws none of its own: a phone gets its 18 px. */
  .stage-pill :global(.segmented) {
    gap: 0;
    padding: 0;
    border: 0;
  }
</style>
