<!--
  Start: make a game, play it, draw its level and put it online, each step one command and what you see after it
  (`start-content.ts`). Then, folded away, how to set up a coding agent for the game. The same look as Home: one lime
  button, white panels on hairlines, 4/6/8 px corners.
-->
<script lang="ts">
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import AgentSetup from './AgentSetup.svelte'
import { PUBLISH_GUIDES, STEPS } from './start-content'
</script>

<PageShell>
  <header class="top">
    <p class="kicker">Start</p>
    <h1>Your first game in four commands.</h1>
    <p class="lead">You need Node 24 and pnpm. Each step is one command in your terminal; under it is what you will see.</p>
  </header>

  <ol class="steps">
    {#each STEPS as step (step.title)}
      <li class="step">
        <h2>{step.title}</h2>
        <CodeBlock code={step.command} variant="command" />
        <p>{step.what}</p>
      </li>
    {/each}
  </ol>

  <p class="guides">
    Other places to put it:
    {#each PUBLISH_GUIDES as [href, label], index (href)}{index > 0 ? ', ' : ' '}<a {href}>{label}</a>{/each}.
  </p>

  <section class="agent">
    <h2>Using a coding agent</h2>
    <p>Your agent works on the game like you do: it edits the files, runs the tests and plays the result. Set it up once.</p>
    <details>
      <summary>Set up your coding agent</summary>
      <AgentSetup />
    </details>
  </section>

  <p class="next"><a class="button" href="/docs">Read the docs</a></p>
</PageShell>

<style>
  .kicker {
    margin: 0;
    color: var(--faint);
    font: 500 13px/20px var(--font-mono);
  }
  h1 {
    margin: 12px 0 0;
  }
  .lead {
    max-width: 620px;
    margin: 20px 0 0;
    color: var(--muted);
    font-size: 18px;
    line-height: 28px;
  }
  .steps {
    display: grid;
    /* minmax(0, …): a long command ellipsizes inside its box instead of widening the column past a phone. */
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin: 48px 0 0;
    padding: 0;
    list-style: none;
  }
  .step {
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--panel);
  }
  h2 {
    margin: 0 0 16px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .step p,
  .agent p {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 24px;
  }
  .guides {
    margin: 24px 0 0;
    color: var(--muted);
  }
  .guides a,
  .agent summary {
    color: var(--ink);
    font-weight: 500;
  }
  .agent {
    margin-top: 72px;
    padding-top: 48px;
    border-top: 1px solid var(--line);
  }
  .agent details {
    margin-top: 16px;
  }
  .agent summary {
    display: flex;
    align-items: center;
    min-height: 44px;
  }
  .next {
    margin: 48px 0 0;
  }
</style>
