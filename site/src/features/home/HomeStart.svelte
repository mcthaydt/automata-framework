<script lang="ts">
// The closing ask: one lime band with one dark button and the command that makes a game. The lime is the page's colour
// and the band is its only full-width use; the grid in the corner is drawn in CSS.
import CopyButton from '../../shared/components/CopyButton.svelte'
import Icon from '../../shared/components/Icon.svelte'
import { CLOSING, CREATE_COMMAND } from './home-content'
</script>

<section class="close">
  <div class="page-wrap">
    <div class="band">
      <h2>{CLOSING.title}</h2>
      <p>{CLOSING.body}</p>
      <div class="cta"><a class="go" href="/start">Make a game <Icon name="arrowRight" /></a></div>
      <div class="cmd">
        <span aria-hidden="true">$</span>
        <code>{CREATE_COMMAND}</code>
        <CopyButton text={CREATE_COMMAND} label="Copy the command" />
      </div>
    </div>
  </div>
</section>

<style>
  .close {
    padding: 0 0 128px;
  }
  .band {
    position: relative;
    overflow: hidden;
    padding: 80px 48px;
    border-radius: var(--edge-lg);
    background: var(--lime);
    color: var(--lime-ink);
  }
  .band::after {
    content: '';
    position: absolute;
    right: -40px;
    bottom: -40px;
    width: 340px;
    height: 340px;
    opacity: 0.14;
    pointer-events: none;
    background:
      linear-gradient(var(--lime-ink) 1px, transparent 1px) 0 0 / 34px 34px,
      linear-gradient(90deg, var(--lime-ink) 1px, transparent 1px) 0 0 / 34px 34px;
  }
  .band > :global(*) {
    position: relative;
    z-index: 1;
  }
  h2 {
    max-width: 720px;
    margin: 0;
    font-size: clamp(34px, 4.6vw, 60px);
  }
  p {
    max-width: 520px;
    margin: 18px 0 0;
    color: #2b3320;
    font-size: 18px;
    line-height: 28px;
  }
  .cta {
    margin-top: 32px;
  }
  .go {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 20px;
    border-radius: var(--edge-sm);
    background: var(--lime-ink);
    color: var(--lime);
    font-weight: 600;
    text-decoration: none;
  }
  .go:hover {
    background: #262b33;
  }
  .cmd {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
    color: #2b3320;
    font: 400 14px / 1.4 var(--font-mono);
  }
  .cmd span {
    color: #3c4630;
  }
  .cmd code {
    padding: 0;
    background: none;
    font-size: inherit;
  }
  .cmd :global(button) {
    color: #3c4630;
    background: none;
    border-color: transparent;
  }
  .cmd :global(button:hover) {
    background: rgb(17 21 28 / 0.08);
    border-color: transparent;
    color: var(--lime-ink);
  }
  @media (max-width: 760px) {
    .band {
      padding: 48px 24px;
    }
    .go {
      width: 100%;
    }
    .cmd code {
      overflow-wrap: anywhere;
    }
  }
</style>
