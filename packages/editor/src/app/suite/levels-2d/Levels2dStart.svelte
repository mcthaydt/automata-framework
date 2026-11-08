<!--
  Levels 2D on a group with no level. On the sample game (the site's try-it) it is where a level starts: the template
  cards, one tap each, and the level opens in their place. On a game folder there are no templates (the game keeps its
  own levels), so it only says there is no level yet.
-->
<script lang="ts">
import TemplateRow from '../../../features/home/TemplateRow.svelte'
import type { Levels2dSession, Levels2dState } from './levels-2d-session'

interface Props {
  session: Levels2dSession
  state: Extract<Levels2dState, { kind: 'empty' }>
}

const { session, state }: Props = $props()
</script>

<div class="start" data-testid="levels-2d-start">
  {#if state.templates.length > 0}
    <h2>Pick a starting point</h2>
    <p>You can change everything later.</p>
    <TemplateRow
      cards={state.templates}
      busy={state.busy}
      oncreate={(profileId, templateId) => void session.create(profileId, templateId)}
    />
  {:else}
    <h2>Your game has no levels yet.</h2>
    <p>A level shows here once your game has one.</p>
  {/if}
  {#if state.problem}<p class="problem" role="alert">{state.problem}</p>{/if}
</div>

<style>
  .start {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(100%, 480px);
    height: 100%;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
    overflow-y: auto;
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  p {
    margin: 0;
    color: var(--muted);
    font: var(--text-body-13);
  }
  .problem {
    color: var(--color-state-bad);
  }
</style>
