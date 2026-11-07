<!-- The kit's Home with stand-ins for an editor's import controls, inspector and what goes below the list. -->
<script lang="ts" generics="E extends { readonly path: string; readonly title: string }">
import type { GeometryState } from '@automata/framework'
import HomeScreen from '../../shared/kit/home/HomeScreen.svelte'
import type { HomeCard } from '../../shared/kit/home/project-browse'
import type { ProjectListSource } from '../../shared/kit/home/project-browser'
import type { Workspace } from '../../shared/kit/storage/workspace'
import type { ToastStore } from '../../shared/kit/widgets/toasts'

// The props are typed inline: a generic component's declaration may not name a private `Props`.
const {
  geometry,
  source,
  card,
  workspace,
  toasts,
  clock,
  onopen,
}: {
  geometry: GeometryState
  source: ProjectListSource<E>
  card: (entry: E) => HomeCard
  workspace: Workspace
  toasts: ToastStore
  clock: { now(): number }
  onopen: (path: string) => void
} = $props()
</script>

<HomeScreen {geometry} {source} {card} {workspace} {toasts} {clock} emptyHint="Import a folder to start." {onopen}>
  {#snippet importers()}<button type="button">Import here</button>{/snippet}
  {#snippet inspector({ selected })}<p data-testid="inspected">{selected?.title ?? 'nothing'}</p>{/snippet}
  {#snippet below()}<p>Below the list</p>{/snippet}
</HomeScreen>
