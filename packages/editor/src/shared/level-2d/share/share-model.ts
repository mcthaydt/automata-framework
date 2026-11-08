import type { DownloadStore } from '../../kit/storage/download-store'
import type { Profile } from '../profiles/profile'

// What the Share menu does, without the menu: which file leaves (the level's own file, the profile's first export) and
// what Download, Share and Copy say when they are done. The menu shows only where Save does not already write the game
// (browser storage, the site's try-it), so this is how a level leaves the browser.

export type ShareAction = 'download' | 'share' | 'copy'

export interface SharedFile {
  readonly path: string
  readonly contents: string
}

/** The level's own file as it stands now; none when the profile exports nothing. */
export function levelFile(profile: Profile<unknown>, value: unknown, base: string): SharedFile | undefined {
  return profile.exports[0]?.files(value, base)[0]
}

export interface ShareItem {
  readonly id: ShareAction
  readonly label: string
  readonly disabled?: boolean
  readonly reason?: string
}

/** The menu's three items; Share says why it is off where the device has no share sheet. */
export function shareItems(canShare: boolean): readonly ShareItem[] {
  return [
    { id: 'download', label: 'Download' },
    canShare
      ? { id: 'share', label: 'Share' }
      : { id: 'share', label: 'Share', disabled: true, reason: "This device can't share files." },
    { id: 'copy', label: 'Copy' },
  ]
}

const DONE: Readonly<Record<ShareAction, string>> = {
  download: 'Downloaded your level.',
  share: 'Shared your level.',
  copy: 'Copied your level. Paste it anywhere to keep it.',
}

export interface ShareOutcome {
  readonly ok: boolean
  readonly message: string
}

/** Runs one action on the file; a dismissed share sheet or a refused clipboard comes back as the store's message. */
export async function shareLevel(
  action: ShareAction,
  file: SharedFile,
  exports: DownloadStore,
): Promise<ShareOutcome> {
  const result =
    action === 'download'
      ? await exports.write(file.path, file.contents)
      : action === 'share'
        ? await exports.share(file.path, file.contents)
        : await exports.copyText(file.contents)
  return result.ok ? { ok: true, message: DONE[action] } : { ok: false, message: result.message }
}
