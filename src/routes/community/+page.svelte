<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { restoration } from '../../data/restorations'
  const discord = restoration('DX.10d')
  const FRAMEWORK = 'https://github.com/mcthaydt/automata-framework'
</script>
<PageMeta title="Community" description="Where to ask questions, report problems and share what you made with Automata." />
<div class="page-shell community-page">
  <h1>Community</h1>
  <p class="lead">Ask, report and show what you made.</p>
  <h2>Report a problem or ask a question</h2>
  <p><a href={FRAMEWORK + '/issues'}>Open an issue on GitHub</a>. Say which version or commit you used, what you ran and what you saw. Anything on this site that is wrong is also an issue.</p>
  <h2>Show what you made</h2>
  <p>The <a href="/showcase">showcase</a> lists starter and reference projects. To suggest your own, open an issue with a link to a playable build and its source.</p>
  <h2>Chat</h2>
  {#if discord.proof && discord.copy}
    <p>{discord.copy}</p>
  {:else}
    <p>There is no chat server yet. It will be linked here once it exists.</p>
  {/if}
  <h2>Contribute</h2>
  <p>The framework is developed in the open at <a href={FRAMEWORK}>mcthaydt/automata-framework</a>. Read <a href="/docs/ai-rules">the rules agents and people follow</a> before sending a change.</p>
</div>
