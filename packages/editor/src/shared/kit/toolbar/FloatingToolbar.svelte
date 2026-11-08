<!--
  The toolbar that floats over an editor's stage: a row of icon buttons on a raised face with a strong edge, 8 px
  corners and a soft shadow, centred at the stage's top (`at="top"`) or foot, or at its bottom right (`"zoom"`, for zoom),
  or, in the compact layout, a dock: a plain bar across the stage's foot, under the thumb, standing at the stage's right
  edge on a phone held sideways. The chosen tool is `ink` on the window colour, reversed. The Level view's tools, and the
  buttons Map, Tiles and Characters open their list and details with, live in one, so every view has the same frame.

  `second` is a group that belongs to a tool and not to every one (the brush size): beside the tools with a hairline
  when the stage is wide, and when the stage is 480 px wide or less (an iPad on its side with the list and the details
  open) on a row of its own under a hairline, with its words ("Brush size") so a person reads what its − and + change.
  The stage is the container, so the host gives it `container-type: inline-size` (the shell's canvas has it).

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
  /** Where it floats: the stage's top or foot, its bottom right, or docked across the foot (the compact layout). */
  at?: 'top' | 'bottom' | 'zoom' | 'dock'
  testId?: string | undefined
  children: Snippet
  second?: { readonly label: string; readonly children: Snippet } | undefined
}

const { label, at = 'bottom', testId, children, second }: Props = $props()
</script>

<div
  class="toolbar"
  role="toolbar"
  aria-label={label}
  data-floating="true"
  data-at={at}
  data-testid={testId}
  data-scroll-region="both"
>
  <div class="main">{@render children()}</div>
  {#if second !== undefined}
    <div class="second" role="group" aria-label={second.label}>
      <span class="rule" aria-hidden="true"></span>
      <span class="words" aria-hidden="true">{second.label}</span>
      {@render second.children()}
    </div>
  {/if}
</div>

<style>
  .toolbar {
    position: absolute;
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    box-sizing: border-box;
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-lg);
    background: var(--raise);
    box-shadow: var(--shadow-sheet);
  }
  .toolbar::-webkit-scrollbar {
    display: none;
  }
  .toolbar[data-at='top'] {
    top: var(--space-3);
    bottom: auto;
  }
  .toolbar[data-at='zoom'] {
    left: auto;
    right: var(--space-3);
    transform: none;
  }
  /* The dock: a bar across the stage's foot with square corners, its controls spread so each thumb reaches one. */
  .toolbar[data-at='dock'] {
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    max-width: none;
    justify-content: space-around;
    border-width: 1px 0 0;
    border-radius: 0;
    box-shadow: none;
  }
  .toolbar[data-at='dock'] :global(.segmented) {
    flex: 1 1 auto;
    justify-content: space-around;
  }
  .main,
  .second {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 2px;
  }
  .rule {
    align-self: stretch;
    margin: var(--space-1) var(--space-1);
    border-left: 1px solid var(--line-strong);
  }
  .words {
    display: none;
    margin-right: var(--space-1);
    color: var(--muted);
    font: var(--text-label-12);
  }
  /* A sheet rises from above the dock, never over it, so the button that opened it (Layers, Details) still closes it and
     the Map's Fit stays in reach. The dock's height: a target, its padding and its top edge. */
  :global(.shell[data-mode='compact']:has(.toolbar[data-at='dock']) [data-presentation='sheet']) {
    margin-bottom: calc(var(--size-hit) + 2 * var(--space-1) + 1px);
    max-height: calc(100% - var(--size-hit) - 2 * var(--space-1) - 1px);
  }
  /* On a phone a sheet rises from the foot: a floating toolbar moves to the top while one is open. */
  :global(.shell[data-mode='compact']:has(:is([data-region='panel'], [data-region='inspector'])[data-open='true']))
    .toolbar[data-at='bottom'] {
    top: var(--space-3);
    bottom: auto;
  }
  /* The chosen tool is reversed, ink on the window colour, so it reads in both looks. */
  .toolbar :global(.segmented .option[aria-checked='true']),
  .toolbar :global(.main .icon-button[aria-pressed='true']),
  .toolbar :global(.second .icon-button[aria-pressed='true']) {
    border-color: transparent;
    background: var(--ink);
    color: var(--bg);
  }
  /* The toolbar is the frame, so a segmented control inside it draws none of its own. */
  .toolbar :global(.segmented) {
    gap: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }

  /* A narrow stage: the second group takes a row under a hairline and says what it is for. */
  @container (max-width: 480px) {
    .toolbar[data-at='top'],
    .toolbar[data-at='bottom'] {
      flex-wrap: wrap;
      justify-content: center;
      width: max-content;
      max-width: calc(100% - 2 * var(--space-3));
      overflow-x: visible;
    }
    .second {
      flex-basis: 100%;
      justify-content: center;
      margin-top: var(--space-1);
      padding-top: var(--space-1);
      border-top: 1px solid var(--line-strong);
    }
    .rule {
      display: none;
    }
    .words {
      display: block;
    }
  }
</style>
