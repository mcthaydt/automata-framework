// Where each photo's PNG is served from: the bundler gives every file under `library/photos/` a URL of its own, so the game
// fetches a photo by name the way it fetches a model.

const URLS = import.meta.glob('./library/photos/*.png', { eager: true, query: '?url', import: 'default' })

/** The URL of a library photo's PNG. An unknown name says which the library has. */
export function photoUrl(name: string): string {
  const url = URLS[`./library/photos/${name}.png`]
  if (typeof url !== 'string')
    throw new Error(
      `There is no photo called "${name}". The library has: ${Object.keys(URLS)
        .map((key) => key.slice('./library/photos/'.length, -'.png'.length))
        .join(', ')}.`,
    )
  return url
}
