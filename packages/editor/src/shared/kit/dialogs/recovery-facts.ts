import { modifiedLabel } from '../home/project-browse'
import type { Recovery } from '../storage/recovery'

// The words of the restore dialog, in plain words (the grandma audit, section 5.2): the document's name and when it
// was changed, never a file name, "autosave" or "on disk".

/** What the restore dialog says about the changes kept from last time, and the warning when keeping them loses another change. */
export function recoveryWords(
  name: string,
  recovery: Recovery,
  now: number,
  timeZone?: string,
): { readonly kept: string; readonly warning: string | undefined } {
  const when = modifiedLabel(recovery.savedAt, now, timeZone)
  // "5 min ago", "yesterday" read after the verb as they are; a date ("Nov 9") needs "on".
  const at = /ago$|^just now$|^yesterday$/.test(when) ? when : `on ${when}`
  return {
    kept: `You changed ${name} ${at} and didn’t save. Your changes were kept.`,
    warning: recovery.baseChanged
      ? `${name} was also changed somewhere else since then. Keeping your changes replaces that.`
      : undefined,
  }
}
