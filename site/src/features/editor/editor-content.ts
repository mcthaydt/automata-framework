// The words and pictures of the Editor page: what the editors do, in five pictures of the real editor, and how to open it.
// The pictures are screenshots of the build this site serves at /editor/app/.

/** The command that opens the editor on a game made with `create-game` (Start's step 3). */
export const EDITOR_COMMAND = 'pnpm exec automata editor'

export interface EditorPicture {
  readonly caption: string
  readonly alt: string
  /** The JPEG every browser shows; a WebP of the same name is offered first. */
  readonly src: string
  readonly width: number
  readonly height: number
}

export const PICTURES: readonly EditorPicture[] = [
  {
    caption: 'Paint a room, then place its characters.',
    alt: 'The level editor on Emberwick: the layers on the left, the room in the middle, its details on the right',
    src: '/previews/editor.jpg',
    width: 1600,
    height: 1000,
  },
  {
    caption: 'Every part of your game has an editor, and the first screen lists what each one holds.',
    alt: 'The editor home: a card for each editor, with the files it opens',
    src: '/previews/editor-every.jpg',
    width: 1100,
    height: 720,
  },
  {
    caption: 'Shape a character, pose it and animate it.',
    alt: 'The Characters 3D editor: the figure in the middle, its poses and clips on the left, its body sliders on the right',
    src: '/previews/editor-characters.jpg',
    width: 1600,
    height: 1000,
  },
  {
    caption: 'Start from a platformer, a top-down map or nothing.',
    alt: 'The New level box: Platformer, Top-down and Blank',
    src: '/previews/editor-new.jpg',
    width: 992,
    height: 964,
  },
  {
    caption: 'It works on a phone and a tablet too.',
    alt: 'The level editor on a phone: the room fills the screen and the tools sit along the bottom',
    src: '/previews/editor-phone.jpg',
    width: 390,
    height: 844,
  },
]
