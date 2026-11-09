<script lang="ts">
// Start's "Using a coding agent": the install steps for the agent the visitor picks, in the order to do them. The site
// cannot see their agent, so it asks the agent to report what it found instead of counting anything itself.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import './agent-setup.css'
import { AGENT_INSTALL_OPTIONS, PIXIJS_INSTALL, SKILL_PREFLIGHT, SKILL_SOURCES } from './agent-setup'

let agent = $state('Codex')
const selected = $derived(AGENT_INSTALL_OPTIONS.find((option) => option.name === agent)!)
</script>

<section class="agent-setup" aria-label="Required agent skills" data-ui>
  <h2>Set up your agent once.</h2>
  <p>
    Give your agent two sets of skills: Superpowers, which plans and tests each change, and PixiJS, which knows how the
    game draws.
  </p>
  <label>
    Your coding agent
    <select bind:value={agent}>
      {#each AGENT_INSTALL_OPTIONS as option (option.name)}<option>{option.name}</option>{/each}
    </select>
  </label>
  <ol class="agent-steps">
    <li>
      <h3>Install Superpowers</h3>
      <p>{selected.instructions}</p>
      {#if selected.command}<CodeBlock code={selected.command} lang="text" label={'In ' + selected.name} />{/if}
      <a href={SKILL_SOURCES.superpowers}>Upstream Superpowers installation</a>
      {#if agent === 'Codex'}<p class="small"><a href={SKILL_SOURCES.codex}>Official OpenAI plugin documentation</a></p>{/if}
    </li>
    <li>
      <h3>Install the PixiJS skills</h3>
      <p>Run this in your game's folder, pick your agent when it asks, and install the whole PixiJS collection.</p>
      <CodeBlock code={PIXIJS_INSTALL} lang="sh" label="In your terminal" />
      <a href={SKILL_SOURCES.pixijs}>Official PixiJS skills installation</a>
    </li>
    <li>
      <h3>Ask your agent to check</h3>
      <p>Paste this to your agent. It should say what it found and what it read. If it says one is missing, install that one first.</p>
      <CodeBlock code={SKILL_PREFLIGHT} lang="text" label="Copy this to your agent" />
    </li>
  </ol>
  <p class="small">Install again when you change agents.</p>
</section>
