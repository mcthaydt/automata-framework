<!--
  @component
  A passing message: "Pad connected", "Saved", "This controller is not supported".
  The owner shows it and takes it away; Toast neither times itself nor takes focus, so a player
  in the middle of a menu is never moved.

  It is a polite live region (`role="status"`), and an error is an alert. Every tone but `info`
  shows a glyph and says `toneLabel` to assistive technology, so the tone survives with every
  colour removed (U-b); a toned toast without words throws while it mounts.

  It sits above Ruken's strip, the safe area and the keyboard, through the geometry owner's inset
  variables, and slides in unless the player asked for less movement.
-->
<script lang="ts">
import { reducedMotion } from '../browser/reduced-motion.js'

type Tone = 'info' | 'success' | 'warning' | 'error'

interface Props {
  text: string
  tone?: Tone | undefined
  /** The tone in words, in the game's language ("Error"). Required for every tone but `info`. */
  toneLabel?: string | undefined
  testId?: string | undefined
}

const { text, tone = 'info', toneLabel, testId }: Props = $props()

const GLYPHS: Record<Tone, string | undefined> = { info: undefined, success: '✓', warning: '!', error: '✕' }

// Checked once, at mount, by design: the first test that mounts a toned toast without words fails.
// svelte-ignore state_referenced_locally
if (tone !== 'info' && (toneLabel ?? '').trim() === '')
  throw new Error(`Toast needs a toneLabel for its ${tone} tone`)

const glyph = $derived(GLYPHS[tone])
// Read once: a toast that is already on screen does not change how it arrived.
const motion = reducedMotion() ? 'none' : 'slide'
</script>

<div
  class="af-toast"
  data-toast
  data-tone={tone}
  data-motion={motion}
  data-testid={testId}
  role={tone === 'error' ? 'alert' : 'status'}
>
  {#if glyph !== undefined}
    <span class="af-toast__glyph" data-toast-glyph aria-hidden="true">{glyph}</span>
    <span class="af-sr-only">{toneLabel}</span>
  {/if}
  <span class="af-toast__text">{text}</span>
</div>

<style>
  /* Bottom centre, inside the insets and above the keyboard; it never covers the whole width. */
  .af-toast {
    position: fixed;
    z-index: 200;
    left: 50%;
    bottom: calc(var(--af-visual-inset-bottom, 0px) + max(var(--af-gutter), var(--af-inset-bottom, 0px)));
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(
      100% - max(var(--af-gutter), var(--af-inset-left, 0px)) - max(var(--af-gutter), var(--af-inset-right, 0px))
    );
    min-height: var(--af-target);
    padding: 8px 16px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    font: 600 var(--af-text-body) / 1.3 var(--af-font);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .af-toast[data-motion="slide"] {
    animation: af-toast-in 160ms ease-out;
  }

  @keyframes af-toast-in {
    from {
      transform: translate(-50%, 12px);
      opacity: 0;
    }
  }

  .af-toast[data-tone="success"] {
    border-color: var(--af-success);
  }

  .af-toast[data-tone="warning"] {
    border-color: var(--af-accent);
  }

  .af-toast[data-tone="error"] {
    border-color: var(--af-danger-edge);
  }

  .af-toast__glyph {
    flex: none;
    font-weight: 800;
  }

  .af-toast__text {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    .af-toast {
      animation: none;
    }
  }
</style>
