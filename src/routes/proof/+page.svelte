<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import ProofReport from '$lib/components/ProofReport.svelte'
  import { EVIDENCE } from '../../data/evidence'
</script>
<PageMeta title="Proof" description="What the framework's own CI proved on its latest run: the same simulation hash in Node, Chromium, Firefox and WebKit, read from the evidence file it writes." />
<div class="page-shell proof-page">
  <h1>Proof</h1>
  <p class="lead">Claims about Automata that a build can check are checked here, from the file the framework’s CI writes. Nothing on this page is typed by hand.</p>
  {#if EVIDENCE}
    <ProofReport evidence={EVIDENCE} />
  {:else}
    <section aria-labelledby="proof-missing-title">
      <h2 id="proof-missing-title">No evidence has been synced yet</h2>
      <p>The site reads the framework’s evidence file at build time. That file has not been copied in, so this page has nothing to show and claims nothing.</p>
    </section>
  {/if}
</div>
