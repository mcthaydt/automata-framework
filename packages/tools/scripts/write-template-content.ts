// Writes the game files of `create-game`'s starter levels: exports `levels/start.af2d.json` of `template-content/` (the
// plain game's) and of `template-story-content/` (the game with the story) with the editor's own export (the code Save
// runs) into the same folder. Run it after changing a level in the editor:
//   node scripts/write-template-content.ts          writes the files
//   node scripts/write-template-content.ts --check  lists the files that differ, and fails if any does
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportContent, openProject } from '@automata/editor/level-export'

const FOLDERS = ['template-content', 'template-story-content'].map((name) =>
  fileURLToPath(new URL(`../src/shared/create-game/${name}/`, import.meta.url)),
)
const PROJECT = 'levels/start.af2d.json'

/** The game files a fresh export of a folder's starter level writes, by their path under the folder. */
function exported(folder: string): readonly { readonly path: string; readonly contents: string }[] {
  const opened = openProject(readFileSync(resolve(folder, PROJECT), 'utf8'))
  if (opened.status !== 'opened') throw new Error(`${folder}${PROJECT} does not open: ${opened.message}`)
  return exportContent(opened.project)
}

const onDisk = (folder: string, path: string): string | undefined => {
  try {
    return readFileSync(resolve(folder, path), 'utf8')
  } catch {
    return undefined
  }
}

/** The paths (under their folder) whose checked-in file is missing or differs from a fresh export; empty when they all agree. */
export function templateContentDrift(): string[] {
  return FOLDERS.flatMap((folder) =>
    exported(folder)
      .filter((file) => onDisk(folder, file.path) !== file.contents)
      .map((file) => `${basename(folder)}/${file.path}`),
  )
}

/** Writes every exported file over the checked-in one. */
export function writeTemplateContent(): void {
  for (const folder of FOLDERS)
    for (const file of exported(folder)) writeFileSync(resolve(folder, file.path), file.contents)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const drift = templateContentDrift()
    for (const path of drift) console.error(`${path} differs from a fresh export of its ${PROJECT}`)
    process.exitCode = drift.length === 0 ? 0 : 1
  } else writeTemplateContent()
}
