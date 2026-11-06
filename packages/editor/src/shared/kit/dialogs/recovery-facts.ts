import { modifiedLabel } from '../home/project-browse'
import type { Recovery } from '../storage/recovery'

// The words of the Restore dialog.

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
