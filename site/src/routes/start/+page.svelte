<script lang="ts">
  import AgentSetup from '$lib/components/AgentSetup.svelte'
  import { AI_PROJECT_PROMPT } from '../../data/ai-guidance'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  const setup = `git clone https://github.com/mcthaydt/automata-framework.git
cd automata-framework
pnpm install --frozen-lockfile
pnpm --filter @af-examples/base-2d dev`
  const checks = `pnpm --filter @af-examples/base-2d test:unit
pnpm --filter @af-examples/base-2d typecheck
pnpm --filter @af-examples/base-2d build`
</script>

<PageMeta title="Make your first AI change" description="Play a double-jump remix, compare it with the original, and give your coding agent the prompt to build it. Source and tests included." />
<div class="page-shell start-page">
  <h1>Make it<br />jump twice.</h1>
  <p class="lead">One small idea. A game that feels different. Try it here before setting anything up.</p>
  <div class="link-row"><a class="button" href="#first-task">Get the prompt</a><a href="#local-setup">Run it locally</a></div>

  <section id="first-task" class="start-step">
    <div><h2>Your turn.<br />Give it a twist.</h2><p>Copy this task into your coding agent with the framework checkout open.</p><p>You choose how the game should feel. Ask the agent to make one change, test it, and show you how to try it.</p><a href="/ai#task-prompts">Choose another game idea</a></div>
    <CodeBlock code={AI_PROJECT_PROMPT} lang="text" filename="First task to copy" />
  </section>

  <section id="local-setup" class="start-step">
    <div><h2>Keep building<br />on your machine.</h2><p>Use Node 24.21 or newer and pnpm 10.34.6. Run Emberwick, then give your agent the task above. No hosted editor is required.</p><div class="link-row"><a href="https://github.com/mcthaydt/automata-framework">Open the repository</a><a href="/docs/capabilities">Capabilities and MIT terms</a></div></div>
    <CodeBlock code={setup} lang="sh" filename="From your terminal" />
  </section>
  <details class="onboarding-depth"><summary>Set up your coding agent</summary><AgentSetup /></details>

  <section class="start-step"><div><h2>Play it.<br />Check the change.</h2><p>Try two jumps, hold the button, try a third jump, and land before jumping again. The agent's tests should cover those same cases.</p><p>Review the files it changed and run the example's checks. If something feels wrong, tell the agent what happened and what you expected.</p></div><CodeBlock code={checks} lang="sh" filename="Verify in the framework checkout" /></section>

  <section><h2>What happens next?</h2><div class="next-changes"><div><h3>Change the room</h3><p>Move platforms, put the ember somewhere new, and choose the player's start.</p><a href="/examples?demo=base-2d&file=games/emberwick/src/shared/room.ts">Edit room content</a><br /><a href="https://github.com/mcthaydt/automata-framework/blob/main/games/emberwick/tests/unit/shared/room.test.ts">Read the room tests</a></div><div><h3>Add a new idea</h3><p>A dash, collectible, or visual response. Give your agent one thing to build next.</p><a href="/ai#task-prompts">Find the next prompt</a></div><div><h3>Get it ready to share</h3><p>Build the game and prepare its manifest. Check your browsers and devices before publishing.</p><a href="/ai#prompt-release">Prepare a release</a></div></div></section>
</div>
