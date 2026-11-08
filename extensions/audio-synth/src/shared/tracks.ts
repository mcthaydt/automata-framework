// Music tracks are files a person put in the game's `assets/music` folder. A track's name in the game is its file's name:
// lower case, words joined with dashes. Audio (the editor) and the player (in play) both name a track this way.

const TRACK_FILE = /\.(ogg|mp3|wav|m4a|flac)$/i

/** Whether a path is a music file the game can play. */
export const isTrackFile = (path: string): boolean => TRACK_FILE.test(path)

/** The name the game knows a track's sound by: the file's own name, lower case, words joined with dashes. */
export function trackAlias(path: string): string {
  const name = (path.split('/').at(-1) ?? path).replace(TRACK_FILE, '')
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The player's `tracks` from the music files a bundler found (Vite's `import.meta.glob('../../assets/music/*', { eager: true,
 * query: '?url', import: 'default' })`): each file's name to the address it is served from.
 */
export function tracksFrom(found: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(found)
      .filter(([path]) => isTrackFile(path))
      .map(([path, url]) => [trackAlias(path), url]),
  )
}
