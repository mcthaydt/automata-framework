// Every picture on the site and how it is taken (scripts/take-pictures.ts). The pages read each picture's size from here,
// so a picture and the box that holds it cannot disagree, and no size is typed in a page.

export interface Picture {
  /** The file under static/previews/, without its extension. */
  readonly name: string
  /** What the script opens, on the built site. */
  readonly url: string
  readonly width: number
  readonly height: number
  /** How long, on the page's own clock, the script lets the page run before it takes the picture (a game's picture is the walk right and a jump that ends there). */
  readonly ms: number
  /** `game`: a demo page, played for a moment. `editor`: the try-it editor, opened on a new level. */
  readonly target: 'game' | 'editor'
}

export const PICTURES: readonly Picture[] = [
  {
    name: 'emberwick',
    url: '/demos/emberwick/index.html',
    width: 1280,
    height: 720,
    ms: 2400,
    target: 'game',
  },
  {
    name: 'hot-reload',
    url: '/demos/hot-reload/index.html',
    width: 1280,
    height: 720,
    ms: 2400,
    target: 'game',
  },
  { name: 'editor', url: '/editor/app/', width: 1600, height: 1000, ms: 1000, target: 'editor' },
  { name: 'editor-new', url: '/editor/app/', width: 820, height: 520, ms: 1000, target: 'editor' },
  { name: 'editor-phone', url: '/editor/app/', width: 390, height: 844, ms: 1000, target: 'editor' },
]

/** The picture called `name`; a name that is not in the list is a mistake in the page that asked. */
export function pictureOf(name: string): Picture {
  const found = PICTURES.find((picture) => picture.name === name)
  if (found === undefined) throw new Error(`No picture called ${name}`)
  return found
}
