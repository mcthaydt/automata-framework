import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './root.ts'

/** The example Home shows: where it is (the folder and the file), and its code as the file has it. */
export interface HomeExample {
  readonly file: string
  /** Its folder, from the repository's root. */
  readonly dir: string
  readonly code: string
}

const PATH = 'examples/2d/shapes/shapes-rects.ts'

/**
 * The shapes example's file minus its header comment (the leading `//` lines, which are the catalogue's), every other
 * byte as written. Read at build time, so Home shows the file as it is and never a copy that can drift from it.
 */
export function homeExample(root: string = repositoryRoot): HomeExample {
  const source = readFileSync(join(root, PATH), 'utf8')
  const code = source.replace(/^(\/\/.*\n)+/, '').trimEnd()
  if (!code.startsWith('import '))
    throw new Error(`${PATH} must start with its imports once its header comment is cut.`)
  return { file: PATH.slice(PATH.lastIndexOf('/') + 1), dir: PATH.slice(0, PATH.lastIndexOf('/')), code }
}
