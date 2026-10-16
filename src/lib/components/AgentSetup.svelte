<script lang="ts">
  import CodeBlock from './CodeBlock.svelte'
  import { AGENT_INSTALL_OPTIONS, PIXIJS_INSTALL, SKILL_PREFLIGHT, SKILL_SOURCES } from '../../data/agent-setup'
  let { ready = $bindable(false) }: { ready?: boolean } = $props()
  let agent = $state('Codex')
  let confirmations = $state({ superpowers: false, pixijs: false, loaded: false })
  const selected = $derived(AGENT_INSTALL_OPTIONS.find(option => option.name === agent)!)
  const count = $derived(Number(confirmations.superpowers) + Number(confirmations.pixijs) + Number(confirmations.loaded))
  $effect(() => { ready = count === 3 })
</script>
<section class="agent-setup" aria-label="Required agent skills" data-ui>
  <h2>Prepare your agent.</h2>
  <p>Use Superpowers for the development workflow and the official PixiJS v8 skills for rendering guidance. Install both for the agent session you will use on this project.</p>
  <label>Your coding agent<select bind:value={agent} onchange={() => { confirmations = { superpowers: false, pixijs: false, loaded: false } }}>{#each AGENT_INSTALL_OPTIONS as option}<option>{option.name}</option>{/each}</select></label>
  <div class="agent-install-layout"><div><h3>Install Superpowers</h3><p>{selected.instructions}</p>{#if selected.command}<CodeBlock code={selected.command} lang="text" filename={'In ' + selected.name} />{/if}<a href={SKILL_SOURCES.superpowers}>Upstream Superpowers installation</a>{#if agent === 'Codex'}<p class="small"><a href={SKILL_SOURCES.codex}>Official OpenAI plugin documentation</a></p>{/if}</div><div><h3>Install PixiJS skills</h3><p>Run this in the game checkout. Follow the installer prompts for your agent and install the PixiJS collection, including the router and the skills it references.</p><CodeBlock code={PIXIJS_INSTALL} lang="sh" filename="In your terminal" /><a href={SKILL_SOURCES.pixijs}>Official PixiJS skills installation</a></div></div>
  <h3>Ask your agent to verify readiness</h3><CodeBlock code={SKILL_PREFLIGHT} lang="text" filename="Skill preflight to copy" />
  <fieldset class="skill-readiness" aria-label="Skill readiness"><legend>Confirm the preflight result</legend>
    <label><input type="checkbox" bind:checked={confirmations.superpowers}>Superpowers is installed for this agent</label>
    <label><input type="checkbox" bind:checked={confirmations.pixijs}>The PixiJS v8 skill collection is installed</label>
    <label><input type="checkbox" bind:checked={confirmations.loaded}>My agent reported and loaded the required skills</label>
  </fieldset>
  <p role="status">{count === 3 ? '3 of 3 confirmed by you. Your agent preflight is complete.' : `${count} of 3 checked. Use this optional checklist when setting up your agent.`}</p>
  <p class="small">This page cannot inspect another app’s installed skills. These confirmations record your preflight check, not automatic detection. Recheck when you change agents or installations.</p>
</section>
