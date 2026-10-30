import { modifiedLabel } from '../home/project-browse'
import type { Recovery } from '../storage/recovery'

// The words of the Restore dialog (kit spec §5 flow 4; moved from editor-2d's `open-flow-model.ts` in ED3D.5c).

/** What the Restore dialog tells about an autosave (mockup `recover`). */
export function recoveryFacts(
  path: string,
  recovery: Recovery,
  now: number,
  timeZone?: string,
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: 'File', value: path.slice(path.lastIndexOf('/') + 1) },
    { label: 'Last autosave', value: modifiedLabel(recovery.savedAt, now, timeZone) },
    {
      label: 'File on disk',
      value: recovery.baseChanged ? 'Changed since the autosave began' : 'Unchanged since the autosave began',
    },
  ]
}
