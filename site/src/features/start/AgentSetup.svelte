<script lang="ts">
// Start's "Using a coding agent": the install steps for the agent the visitor picks, in the order to do them. The site
// cannot see their agent, so it asks the agent to report what it found instead of counting anything itself.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import './agent-setup.css'
import {
  AGENT_INSTALL_OPTIONS,
  automataInstall,
  PIXIJS_INSTALL,
  SKILL_PREFLIGHT,
  SKILL_SOURCES,
} from './agent-setup'

let agent = $state('Codex')
const selected = $derived(AGENT_INSTALL_OPTIONS.find((option) => option.name === agent)!)
</script>

<section class="agent-setup" aria-label="Required agent skills" data-ui>
  <h2>Set up your agent once.</h2>
  <p>
    Give your agent Automata's skills first. They tell it how a game here is built, and how what you change in the
    editors reaches the game.
  </p>
  <label>
    Your coding agent
    <select bind:value={agent}>
      {#each AGENT_INSTALL_OPTIONS as option (option.name)}<option>{option.name}</option>{/each}
    </select>
  </label>
  <ol class="agent-steps">
    <li>
      <h3>Install Automata’s skills</h3>
      {#if agent === 'Claude Code'}
        <p>Run these two in Claude Code, one after the other. A game made with the create-game command also asks for them by itself: say yes.</p>
      {:else}
        <p>Run this in your game's folder, pick your agent when it asks, and install them all.</p>
      {/if}
      {#each automataInstall(agent) as command (command)}
        <CodeBlock code={command} lang={agent === 'Claude Code' ? 'text' : 'sh'} label={agent === 'Claude Code' ? 'In ' + agent : 'In your terminal'} />
      {/each}
    </li>
    <li>
      <h3>Ask your agent to check</h3>
      <p>Paste this to your agent. It should say what it found and what it read. If it says Automata's skills are missing, install them first.</p>
      <CodeBlock code={SKILL_PREFLIGHT} lang="text" label="Copy this to your agent" />
    </li>
  </ol>
  <h2>Also useful</h2>
  <p>These two are not needed, and the agent carries on without them. Install them if you want them.</p>
  <ul class="agent-steps">
    <li>
      <h3>Superpowers</h3>
      <p>It plans and tests each change. {selected.instructions}</p>
      {#if selected.command}<CodeBlock code={selected.command} lang="text" label={'In ' + selected.name} />{/if}
      <a href={SKILL_SOURCES.superpowers}>Upstream Superpowers installation</a>
      {#if agent === 'Codex'}<p class="small"><a href={SKILL_SOURCES.codex}>Official OpenAI plugin documentation</a></p>{/if}
    </li>
    <li>
      <h3>The PixiJS skills</h3>
      <p>They know how the game draws. Run this in your game's folder, pick your agent when it asks, and install the whole PixiJS collection.</p>
      <CodeBlock code={PIXIJS_INSTALL} lang="sh" label="In your terminal" />
      <a href={SKILL_SOURCES.pixijs}>Official PixiJS skills installation</a>
    </li>
  </ul>
  <p class="small">Install again when you change agents.</p>
</section>
