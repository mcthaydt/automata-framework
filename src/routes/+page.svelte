<script lang="ts">
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { STARTER_CODE } from '../data/starter'
  import { getDemosCatalog } from '../data/demos'
  const previews = ['renderer-2d', 'bodies-2d', 'ui-primitives', 'boot-and-flow'].map(slug => getDemosCatalog().find(d => d.slug === slug)).filter(d => d !== undefined)
</script>
<PageMeta title="Games, in your hands" />
<section class="hero chapter">
  <h1 data-rise>Games, in<br />your hands.</h1>
  <div class="hero-bottom"><p data-rise>Build TypeScript games with deterministic simulation and PixiJS, for the web and Ruken.</p><a data-rise class="button" href="#play">Play the starter</a></div>
</section>
<section id="play" class="chapter white-field play-section">
  <div class="section-intro"><h2 data-rise>Rules become<br />a room.</h2><div><p data-rise>Run and jump through Emberwick, the framework's playable 2D starter.</p><p>Move with arrows or A/D. Jump with Space. Touch controls appear on supported devices.</p><a href="/examples?demo=base-2d">See the source and controls</a></div></div>
  <DemoRunner src="/demos/base-2d/index.html" title="Emberwick" />
</section>
<section class="chapter pink-field">
  <h2 data-rise>Open the machinery.</h2>
  <p data-rise>Each example isolates a working part of the framework. Start it here, then open the gallery to read the code.</p>
  <div class="demo-showcase">
    {#each previews as demo}<article data-rise><h3>{demo.title}</h3><p>{demo.shows}</p><DemoRunner src={demo.bundleUrl} title={demo.title} autoStart={false} /><a href={'/examples?demo=' + demo.slug}>Inspect this example</a></article>{/each}
  </div>
</section>
<section class="chapter cyan-field ownership">
  <div><h2 data-rise>One state.<br />Many views.</h2><p data-rise>Gameplay belongs to the simulation. Everything else works around it.</p>
    <dl class="ownership-list"><div data-rise><dt>Simulation</dt><dd>Systems change gameplay state in fixed ticks. Seeded randomness and snapshots support repeatable runs.</dd></div><div data-rise><dt>Presentation</dt><dd>PixiJS reads render deltas and interpolates between ticks. WebGL2 is the default; WebGPU is opt-in.</dd></div><div data-rise><dt>Runtime</dt><dd>Effect manages loading, errors, and resource lifetimes outside the simulation.</dd></div></dl>
  </div><div data-rise><CodeBlock code={STARTER_CODE} filename="motion.ts" /><p>A complete simulation example. Rendering is a separate step.</p></div>
</section>
<section class="chapter orange-field closing"><h2 data-rise>Make the<br />next move.</h2><div><p data-rise>Automata is a developer preview. Start with the setup guide for repository access and local development.</p><a class="button" href="/docs/quick-start">Read the setup guide</a></div></section>
