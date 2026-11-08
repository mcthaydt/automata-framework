<script lang="ts">
// Home's first screen: an announcement, the claim, the two actions, the first command, and the game under them.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import CopyButton from '../../shared/components/CopyButton.svelte'
import Icon from '../../shared/components/Icon.svelte'
import HomeDemo from './HomeDemo.svelte'
import { ACTIONS, AGENT_PROMPT, ANNOUNCEMENT, CREATE_COMMAND, HERO } from './home-content'
</script>

<section class="hero">
  <div class="page-wrap">
    <a class="pill" href={ANNOUNCEMENT.href}><b>{ANNOUNCEMENT.tag}</b>{ANNOUNCEMENT.words}<Icon name="arrowRight" size={14} /></a>
    <h1>{HERO.title}</h1>
    <p class="lead">{HERO.lead}</p>
    <div class="actions">
      <a class="button" href="/start">{ACTIONS.make} <Icon name="arrowRight" /></a>
      <CopyButton text={AGENT_PROMPT} caption={ACTIONS.copyPrompt} label={ACTIONS.copyPrompt} />
    </div>
    <div class="cmd"><CodeBlock code={CREATE_COMMAND} variant="command" /></div>
    <HomeDemo />
  </div>
</section>

<style>
  /* The faint grid behind the claim fades out below it; it is the page's only decoration, drawn in CSS. */
  .hero {
    position: relative;
    padding: 96px 0 0;
    overflow: hidden;
    text-align: center;
  }
  .hero::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 640px;
    background:
      linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 48px 48px,
      linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 48px 48px;
    mask-image: radial-gradient(ellipse 60% 70% at 50% 0%, #000 20%, transparent 75%);
    opacity: 0.55;
    pointer-events: none;
  }
  .hero > :global(.page-wrap) {
    position: relative;
  }
  /* The announcement: a 4 px pill's worth of corner on a lime tag, never a round pill. */
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px 0 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-md);
    background: var(--panel);
    color: var(--muted);
    font-size: 13px;
    text-decoration: none;
  }
  .pill:hover {
    color: var(--ink);
  }
  .pill b {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 8px;
    border-radius: var(--edge-sm);
    background: var(--lime);
    color: var(--lime-ink);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }
  h1 {
    max-width: 900px;
    margin: 20px auto 0;
    font-size: clamp(42px, 6vw, 76px);
    line-height: 1.02;
    letter-spacing: -0.04em;
  }
  .lead {
    max-width: 600px;
    margin: 22px auto 0;
    color: var(--muted);
    font-size: 19px;
    line-height: 30px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 36px;
  }
  /* The prompt button is the secondary at the primary's height; "Copied" sits under it so the row does not shift. */
  .actions :global(.copy-control) {
    position: relative;
  }
  .actions :global(.copy-control button) {
    min-height: 48px;
    padding: 0 18px;
    border-color: var(--line-strong);
    background: var(--raise);
    font-size: 15px;
  }
  .actions :global(.copy-control span[role='status']) {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    margin-top: 4px;
    font-size: 13px;
    text-align: center;
  }
  /* The command is a plain line, not a box: the copy icon is its only button. */
  .cmd {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
  .cmd :global(.command) {
    min-height: 44px;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  @media (max-width: 760px) {
    .hero {
      padding-top: 56px;
      text-align: left;
    }
    h1,
    .lead {
      margin-left: 0;
    }
    .actions {
      flex-direction: column;
      align-items: stretch;
    }
    .actions :global(.button),
    .actions :global(.copy-control),
    .actions :global(.copy-control button) {
      width: 100%;
    }
    .cmd {
      justify-content: flex-start;
    }
    .cmd :global(.command) {
      max-width: 100%;
      padding-left: 0;
    }
  }
</style>
