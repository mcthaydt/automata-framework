// Every picture on the site and how it is taken (scripts/take-pictures.ts). The pages read each picture's size from here,
// so a picture and the box that holds it cannot disagree, and no size is typed in a page.

export interface Picture {
  /** The file under static/previews/, without its extension. */
  readonly name: string
  /** What the script opens, on the built site. */
  readonly url: string
  /** The picture's size in pixels: the window the script opens, unless `cut` says the picture is a part of a larger one. */
  readonly width: number
  readonly height: number
  /** A picture that is a part of its window: the window's size, and where in it the picture's corner is. */
  readonly cut?: {
    readonly window: { readonly width: number; readonly height: number }
    readonly x: number
    readonly y: number
  }
  /** How long, on the page's own clock, the script lets the page run before it takes the picture (a game's picture is the walk right and a jump that ends there). */
  readonly ms: number
  /**
   * `game`: a demo page, played for a moment. `editor`: the try-it editor, opened on a new level. `example`: an example's
   * playground page, run for `ms` and the picture of the game in its preview.
   */
  readonly target: 'game' | 'editor' | 'example'
}

export const PICTURES: Picture[] = [
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
  // The choices only: the box's own title is dark on the editor's dark field, and the editor's look is not this page's to change.
  {
    name: 'editor-new',
    url: '/editor/app/',
    width: 480,
    height: 258,
    cut: { window: { width: 820, height: 520 }, x: 0, y: 124 },
    ms: 1000,
    target: 'editor',
  },
]

/** The examples Home shows (home-content.ts holds the same list and a test keeps the two together). */
const EXAMPLE_PICTURES = [
  'shapes-rects',
  'shapes-draw-hud',
  'textures-atlas',
  'textures-sprite',
  'render-filter',
  'core-camera-2d',
] as const

PICTURES.push(
  ...EXAMPLE_PICTURES.map(
    (id): Picture => ({
      name: `example-${id}`,
      url: `/examples/${id}`,
      width: 1280,
      height: 900,
      ms: 3000,
      target: 'example',
    }),
  ),
)

/** The picture called `name`; a name that is not in the list is a mistake in the page that asked. */
export function pictureOf(name: string): Picture {
  const found = PICTURES.find((picture) => picture.name === name)
  if (found === undefined) throw new Error(`No picture called ${name}`)
  return found
}
