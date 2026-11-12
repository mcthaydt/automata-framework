<!--
  @component
  The studio's splash: the logo, centred and never more than 60% of the shorter side, with one line under it saying a
  press goes on. Any key, click or tap calls `onDone`; how long it is held is the caller's (`splashStep` holds it on the
  runtime's clock). It plays no sound. Edit the logo's setting, or swap the line: the frame keeps both inside the
  visible region. A copy of this folder in a game works alone and takes its own words as props.
-->
<script lang="ts">
import { ScreenFrame } from '@automataframework/framework'

interface Props {
  /** The studio's image: the game's own file, and the words a screen reader says for it. */
  logo: { readonly src: string; readonly alt: string }
  /** The line under the logo. */
  copy: { readonly skip: string }
  /** Called on any key, click or tap, possibly more than once: the caller ends the splash on the first. */
  onDone: () => void
}

const { logo, copy, onDone }: Props = $props()
</script>

<!-- A key goes on from anywhere on the page, since nothing here takes focus. -->
<svelte:document onkeydown={onDone} />

{#snippet body()}
  <div class="splash__body">
    <img class="splash__logo" src={logo.src} alt={logo.alt} draggable="false" />
    <p class="splash__skip">{copy.skip}</p>
  </div>
{/snippet}

<!-- A press anywhere goes on, so the whole screen listens; a keyboard or switch player is served by the document's key above. -->
<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="splash" data-game-screen="splash" onpointerdown={onDone} onclick={onDone}>
  <ScreenFrame arrangement="stack" testId="splash-screen" {body} />
</div>

<style>
  .splash__body {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--af-gutter);
    min-width: 0;
    min-height: 0;
  }

  /* 60% of the body's shorter side: the body is a size container, so this follows the space the game leaves. */
  .splash__logo {
    display: block;
    max-width: min(60cqmin, 100%);
    max-height: 60cqmin;
    object-fit: contain;
    user-select: none;
    animation: splash-in 400ms ease-out;
  }

  .splash__skip {
    margin: 0;
    font: 400 calc(14px * var(--af-scale, 1)) / 1.3 var(--af-font);
    text-align: center;
    overflow-wrap: anywhere;
    opacity: 0.8;
  }

  @keyframes splash-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .splash__logo {
      animation: none;
    }
  }
</style>
