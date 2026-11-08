<!--
  The open cutscene: the plan on top, the transport under it (Play, the time, zoom), the timeline, and the fields of the
  chosen step. A game without cutscenes asks for the first one's name and length; a file with a mistake opens read only
  and says where the mistake is.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import EditorPage from '../../shared/ui/EditorPage.svelte'
import SequenceAdd from './SequenceAdd.svelte'
import SequenceInspector from './SequenceInspector.svelte'
import SequencePreview from './SequencePreview.svelte'
import SequenceTimeline from './SequenceTimeline.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session }: { session: SequenceSession } = $props()
const read = $derived(session.current?.read)
const script = $derived(session.script)
const seconds = (value: number): string => String(Math.round(value * 10) / 10)
</script>

<EditorPage label="Sequence">
  {#if session.current === undefined}
    <div class="empty">
      <h2>This game has no cutscenes yet.</h2>
      <p>A cutscene is the game taking the camera for a moment. Give the first one a name and a length.</p>
      <SequenceAdd {session} />
    </div>
  {:else if read?.kind === 'syntax'}
    <div class="empty">
      <h2>This cutscene has a mistake{read.line === undefined ? '' : ` on line ${String(read.line)}`}.</h2>
      <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
    </div>
  {:else if script === undefined}
    <div class="empty">
      <h2>This cutscene cannot be shown yet.</h2>
      <p>Something in the file is not in the right place. The problems are listed below.</p>
    </div>
  {:else}
    <div class="stage">
      <SequencePreview {session} />
      <div class="transport" role="group" aria-label="Playing">
        {#if session.playing}
          <Button variant="primary" onclick={() => session.pause()}>Pause</Button>
        {:else}
          <Button variant="primary" onclick={() => session.play()}>Play</Button>
        {/if}
        <span class="time" aria-live="off">{seconds(session.playhead)} s of {seconds(script.duration)} s</span>
        <Button variant="quiet" onclick={() => (session.zoom = Math.max(20, session.zoom / 1.5))}>Zoom out</Button>
        <Button variant="quiet" onclick={() => (session.zoom = Math.min(240, session.zoom * 1.5))}>Zoom in</Button>
      </div>
      <div class="work">
        <SequenceTimeline {session} />
        <SequenceInspector {session} />
      </div>
    </div>
  {/if}
</EditorPage>

<style>
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
  .stage {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .time {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .work {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  @media (min-width: 820px) {
    .work {
      grid-template-columns: minmax(0, 1fr) 18rem;
      align-items: start;
    }
  }
</style>
