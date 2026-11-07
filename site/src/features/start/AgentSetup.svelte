<script lang="ts">
// Start's "Using a coding agent": the install steps for the agent the visitor picks, and a checklist they tick
// themselves. The site cannot see their agent, so the count says what they confirmed, not what is installed.
import CodeBlock from '../../shared/components/CodeBlock.svelte'
import {
  AGENT_INSTALL_OPTIONS,
  AUTOMATA_INSTALL,
  PIXIJS_INSTALL,
  SKILL_PREFLIGHT,
  SKILL_SOURCES,
} from './agent-setup'

let { ready = $bindable(false) }: { ready?: boolean } = $props()
let agent = $state('Codex')
let confirmations = $state({ superpowers: false, pixijs: false, loaded: false })
const selected = $derived(AGENT_INSTALL_OPTIONS.find((option) => option.name === agent)!)
const count = $derived(
  Number(confirmations.superpowers) + Number(confirmations.pixijs) + Number(confirmations.loaded),
)
$effect(() => {
  ready = count === 3
})
</script>
<section class="agent-setup" aria-label="Required agent skills" data-ui>
  <h2>Set up your agent once.</h2>
  <p>Give your agent three sets of skills: Superpowers, which plans and tests each change, PixiJS, which knows how the game draws, and the Automata skills, which know this framework.</p>
  <label>Your coding agent<select bind:value={agent} onchange={() => { confirmations = { superpowers: false, pixijs: false, loaded: false } }}>{#each AGENT_INSTALL_OPTIONS as option}<option>{option.name}</option>{/each}</select></label>
  <div class="agent-install-layout"><div><h3>Install Superpowers</h3><p>{selected.instructions}</p>{#if selected.command}<CodeBlock code={selected.command} lang="text" filename={'In ' + selected.name} />{/if}<a href={SKILL_SOURCES.superpowers}>Upstream Superpowers installation</a>{#if agent === 'Codex'}<p class="small"><a href={SKILL_SOURCES.codex}>Official OpenAI plugin documentation</a></p>{/if}</div><div><h3>Install PixiJS skills</h3><p>Run this in your game's folder, pick your agent when it asks, and install the whole PixiJS collection.</p><CodeBlock code={PIXIJS_INSTALL} lang="sh" filename="In your terminal" /><a href={SKILL_SOURCES.pixijs}>Official PixiJS skills installation</a></div></div>
  <div class="agent-automata"><h3>The Automata skills</h3><p>They teach your agent this framework’s rules and API. In Claude Code, type:</p><CodeBlock code={AUTOMATA_INSTALL.marketplace} lang="text" filename="First line, in Claude Code" /><CodeBlock code={AUTOMATA_INSTALL.plugin} lang="text" filename="Second line, in Claude Code" /><p>Other agents:</p><CodeBlock code={AUTOMATA_INSTALL.skills} lang="sh" filename="In your game’s folder" /><p class="small">Tested on {AUTOMATA_INSTALL.testedOn}.</p></div>
  <h3>Ask your agent to check</h3><CodeBlock code={SKILL_PREFLIGHT} lang="text" filename="Copy this to your agent" />
  <fieldset class="skill-readiness" ><legend>What your agent said</legend>
    <label><input type="checkbox" bind:checked={confirmations.superpowers}>Superpowers is installed for this agent</label>
    <label><input type="checkbox" bind:checked={confirmations.pixijs}>The PixiJS v8 skill collection is installed</label>
    <label><input type="checkbox" bind:checked={confirmations.loaded}>My agent reported and loaded the required skills</label>
  </fieldset>
  <p role="status">{count === 3 ? '3 of 3 ticked. Your agent is ready.' : `${count} of 3 ticked. The boxes are only for you.`}</p>
  <p class="small">This page can’t see what your agent has installed, and nothing you tick is sent anywhere. Tick them again when you change agents.</p>
</section>
