<!--
  The 2D editor's Home: the kit's `HomeScreen` (the sources panel, the projects
  with a search, the selected project, shared with the 3D editor) with what is the 2D editor's own: Import
  files, the template cards under the list, the summary with Open, Duplicate and Delete, and the delete dialog.

  This component only wires: the controller decides (see `home-controller.ts` and `home-model.ts`). It knows no
  profile; the templates, kinds and summaries all come from the registry.
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata'
import { tick } from 'svelte'
import FilePick from '../../shared/kit/home/FilePick.svelte'
import HomeScreen from '../../shared/kit/home/HomeScreen.svelte'
import { splitPath } from '../../shared/kit/home/project-browse'
import type { Workspace } from '../../shared/kit/storage/workspace'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'
import type { ProfileRegistry } from '../../shared/level-2d/profiles/profile'
import type { ProjectEntry } from '../../shared/level-2d/session/editor-app-types'
import DeleteDialog from './DeleteDialog.svelte'
import type { HomeController } from './home-controller'
import { homeCard, templateCards } from './home-model'
import ProjectSummary from './ProjectSummary.svelte'
import TemplateRow from './TemplateRow.svelte'

interface Props {
  geometry: GeometryState
  controller: HomeController
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  /** The time the ages on the cards are told against. */
  clock: { now(): number }
  /** Draws the cards' preview levels; absent, every card shows its initial. */
  thumbnails?: LevelThumbnails | undefined
}

const { geometry, controller, workspace, registry, toasts, clock, thumbnails }: Props = $props()

let deleteOpen = $state(false)
let home = $state<{ focusList(): void }>()

const cards = $derived(templateCards(registry))
const card = (entry: ProjectEntry) => homeCard(entry, registry, thumbnails)

async function confirmDelete(): Promise<void> {
  await controller.remove()
  await tick()
  home?.focusList()
}
</script>

<HomeScreen
  bind:this={home}
  {geometry}
  source={controller}
  {card}
  {workspace}
  {toasts}
  {clock}
  emptyHint="Pick a template below to start one."
  onopen={(path) => controller.open(path)}
  ondelete={() => (deleteOpen = true)}
>
  {#snippet importers({ busy })}
    <FilePick label="Import files…" multiple {busy} onpick={(files) => controller.importFiles(files)} />
  {/snippet}

  {#snippet below({ busy })}
    <TemplateRow {cards} {busy} oncreate={(profileId, templateId) => controller.create(profileId, templateId)} />
  {/snippet}

  {#snippet inspector({ selected, busy, now })}
    <ProjectSummary
      entry={selected}
      {busy}
      {now}
      onopen={() => controller.open()}
      onduplicate={() => controller.duplicate()}
      ondelete={() => (deleteOpen = true)}
    />
  {/snippet}

  {#snippet sheets({ selected })}
    <DeleteDialog
      bind:open={deleteOpen}
      name={selected === undefined ? '' : splitPath(selected.path).name}
      onconfirm={confirmDelete}
    />
  {/snippet}
</HomeScreen>
