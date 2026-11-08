// The words of the Editor page: what the 2D level editor does, in three pictures of the real editor, and how to open
// it. The pictures are taken by scripts/take-pictures.ts from the build this site serves at /editor/app/, and each
// one's size comes from the list that script reads, so the box and the picture cannot disagree.
import { pictureOf } from '../../shared/pictures'

/** The command that opens the editor on a game made with `create-game` (Start's step 3). */
export const EDITOR_COMMAND = 'pnpm exec automata editor'

/** What the try-it editor does and does not do, said once on the page (Owner choice R8: no Play here yet). */
export const EDITOR_PLAY_NOTE =
  'The try-it editor cannot play a level. To play one, open the editor on your own game with the command below.'

export interface EditorPicture {
  readonly caption: string
  readonly alt: string
  /** The JPEG every browser shows; a WebP of the same name is offered first. */
  readonly src: string
  readonly width: number
  readonly height: number
}

function picture(name: string, caption: string, alt: string): EditorPicture {
  const { width, height } = pictureOf(name)
  return { caption, alt, src: `/previews/${name}.jpg`, width, height }
}

export const PICTURES: readonly EditorPicture[] = [
  picture(
    'editor',
    'Paint a room, then place its characters.',
    'The level editor on a new platformer: the layers on the left, the room in the middle, a few coins and a slime placed in it',
  ),
  picture(
    'editor-new',
    'Start from a platformer, a top-down map or nothing.',
    'The three ways to start a level: Platformer, Top-down and Blank',
  ),
]
