<script lang="ts">
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import SourceExplorer from '$lib/components/SourceExplorer.svelte'
  import CreativeStarts from '$lib/components/CreativeStarts.svelte'
  import LazyPicture from '$lib/components/LazyPicture.svelte'
  import { AUDIENCE_FIT, AUDIENCE_NOT_FIT, FAQ_ITEMS } from '../data/audience'
  import { MIGRATION_GUIDES } from '../data/migrations'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
  const sourceGuides = [
    { label: 'Edit the room', path: 'games/emberwick/src/content/room.ts', description: 'Author the room as content: # is solid, . is empty, P is the player start and G is the goal. Keep one P and one G, equal row widths, and empty space above P.' },
    { label: 'Read a test', path: 'games/emberwick/src/content/room.test.ts', description: 'These unit tests check room dimensions, start and goal positions, collision boundaries and malformed content. Read the expected behavior before changing the room.' },
    { label: 'Simulation', path: 'games/emberwick/src/sim/player-move.system.ts', description: 'The movement system reads control state, applies gravity and collision rules, and writes player state inside fixed simulation ticks.' },
    { label: 'Presentation', path: 'games/emberwick/src/render/renderer.ts', description: 'The renderer draws the room, character and lighting from the current game state. Gameplay rules stay in the simulation.' },
    { label: 'Wiring', path: 'games/emberwick/src/play-room.ts', description: 'The playable room connects input, simulation and rendering. Follow onStep into sim.step and onFrame into drawing; loop.ts owns the fixed-step schedule.' },
    { label: 'Boot', path: 'games/emberwick/src/boot.ts', description: 'Effect handles the Ruken handshake and readiness outside simulation code. The SDK also supports running this game standalone.' },
  ]
  const previews = [
    { slug: 'renderer-2d', title: 'Rendering', description: 'PixiJS rendering with sub-tick interpolation and a screen-space shader.' },
    { slug: 'bodies-2d', title: 'Physics', description: 'Dynamic bodies, collisions and repeatable simulation inside Emberwick.' },
    { slug: 'hot-reload', title: 'Content', description: 'An authored room with content updates applied while the game runs.' },
    { slug: 'lifecycle-and-saves', title: 'Hosting', description: 'Lifecycle state and save handling, with standalone and host-aware behavior.' },
  ]
</script>
<PageMeta title="Make a game. Make it yours." description="Make browser games with your coding agent. Play a starter, try a double jump, copy a tested task, and make the next change your own." />
<section class="hero chapter">
  <div class="hero-heading">
    <div><h1>Make a game.<br />Make it yours.</h1></div>
    <div class="hero-copy"><p>A TypeScript framework for browser games. You bring the idea; your coding agent helps with code and tests.</p><a class="button" href="/start#worked-change">Make your first change</a><a class="hero-guide" href="#play">Play the starter</a></div>
  </div>
  <div id="play" class="hero-stage">
    <span class="vertical-label" aria-hidden="true">Emberwick</span>
    <DemoRunner src="/demos/base-2d/index.html" title="Emberwick" autoStart={false} poster="/previews/emberwick.jpg" posterAlt="Emberwick platforming gameplay" />
    <div class="stage-caption"><p>Emberwick, the playable 2D starter.</p><p>Move with arrows or A/D. Jump with Space.</p><a href="/examples?demo=base-2d">Source and controls</a></div>
  </div>
</section>
<section class="chapter first-change-intro"><div><h2>One more jump.<br />Your first remix.</h2><p>Turn on double jump. Press jump again in the air. Feel the difference, then give your agent the prompt that builds it.</p></div><div class="first-change-actions"><p>Play the original and the remix here. Follow the actual code and tests when you are ready to make it yours.</p><a class="button" href="/start#worked-change">Try a double jump</a><a href="/start#first-task">Get the prompt</a></div></section>
<section class="chapter creative-section"><div class="section-heading"><h2>Pick your<br />starting point.</h2><p>Platforming, a new movement trick, or a room full of physics. These are working starters and demos you can play and extend.</p></div><CreativeStarts /></section>
<section class="chapter workflow-section">
  <div class="workflow-intro"><h2>Have an idea?<br />Give it a go.</h2><p>Ask for a dash. Add a collectible. Change the room. Make one thing work, play it, and choose what comes next.</p><a href="/ai#task-prompts">Choose a prompt for your agent</a></div>
  <dl class="workflow-details">
    <div><dt>Agents write code and tests</dt><dd>Give an agent the project rules and a focused task. Use type checks, simulation tests and browser checks to review what it produces.</dd></div>
    <div><dt>You make the content</dt><dd>Shape the rooms, art, rules and narrative. Keep creative decisions with the people making the game.</dd></div>
    <div><dt>Step in at any point</dt><dd>Open the source, change a system, or ask an agent to revise one part. Explicit ownership and separate packages give a growing project structure you can work with.</dd></div>
    <div><dt>Browser and mobile foundations</dt><dd>Browser delivery, phone-first UI and keyboard and touch examples are here to build on. Deterministic state, snapshots and replays lay the groundwork for multiplayer; networking and server packages are planned.</dd></div>
  </dl>
</section>
<section id="fit" class="chapter fit-section"><div><h2>Who this is for</h2><ul>{#each AUDIENCE_FIT as item}<li>{item}</li>{/each}</ul></div><div><h2>Who this is not for</h2><ul>{#each AUDIENCE_NOT_FIT as item}<li>{item}</li>{/each}</ul></div></section>
<section class="chapter migration-section"><div><h2>Bring what<br />you know.</h2><p>Start with familiar concepts, then rebuild one small feature with explicit ownership.</p></div><nav aria-label="Coming from another engine">{#each MIGRATION_GUIDES as guide}<a href={'/docs/' + guide.slug}>From {guide.engine}</a>{/each}</nav></section>
<section class="chapter examples-section">
  <div class="section-heading"><h2>Explore the<br />working parts.</h2><p>Give your agent a working example to extend. Run it here, inspect every project file, then make the next change yourself or with AI.</p><a href="/examples">Browse all examples</a></div>
  <div class="example-index">
    {#each previews as demo}
      <article>
        <a class="example-preview" href={'/examples?demo=' + demo.slug} aria-label={'Explore ' + demo.title.toLowerCase()}><LazyPicture src={'/previews/' + demo.slug + '.jpg'} alt={demo.title + ' example running in Automata'} width={960} height={600} aspect="16 / 10" sizes="(max-width: 700px) 100vw, 40vw" /></a>
        <div class="example-description"><h3><a href={'/examples?demo=' + demo.slug}>{demo.title}</a></h3><p>{demo.description}</p></div>
      </article>
    {/each}
  </div>
</section>
<section class="chapter architecture-section">
  <div class="section-heading"><h2>One state.<br />Many views.</h2><p>Clear ownership makes changes easier to review. Follow the real files your agent will work in.</p></div>
  <SourceExplorer project={data.starterProject} initialFile={sourceGuides[0].path} guides={sourceGuides} />
  <p class="source-architecture-link"><a href="/docs/overview">Read the architecture</a></p>
</section>
<section id="faq" class="chapter faq-section"><div><h2>FAQ</h2><p>The practical questions before you build.</p><a href="/docs/faq">Read all questions</a></div><div class="faq-list">{#each FAQ_ITEMS.filter((_, index) => [0, 2, 4, 7, 9, 10].includes(index)) as item}<article><h3>{item.question}</h3><p>{item.answer}</p></article>{/each}</div></section>
<section class="chapter showcase-invitation"><div><h2>What will<br />you make?</h2></div><div><p>Play the starters, see the work that shaped Automata, or submit your own game. Community submissions are reviewed before publication.</p><a href="/showcase">Browse the community showcase</a></div></section>
<section class="chapter setup-section closing"><div><h2>Your idea.<br />Next playable.</h2></div><div><p>Take the working starter, give your agent one change, and play what happens. The framework code is MIT licensed for personal and commercial games.</p><a class="button" href="/start">Make your first change</a></div></section>
