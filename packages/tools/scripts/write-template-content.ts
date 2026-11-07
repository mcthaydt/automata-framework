// Writes the game files of `create-game`'s starter level: exports `template-content/levels/start.af2d.json` with the
// editor's own export (the code Save runs) into `template-content/`. Run it after changing the level in the editor:
//   node scripts/write-template-content.ts          writes the files
//   node scripts/write-template-content.ts --check  lists the files that differ, and fails if any does
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportContent, openProject } from '@automata/editor/level-export'

const FOLDER = fileURLToPath(new URL('../src/shared/create-game/template-content/', import.meta.url))
const PROJECT = 'levels/start.af2d.json'

/** The game files a fresh export of the starter level writes, by their path under `template-content/`. */
function exported(): readonly { readonly path: string; readonly contents: string }[] {
  const opened = openProject(readFileSync(resolve(FOLDER, PROJECT), 'utf8'))
  if (opened.status !== 'opened') throw new Error(`${PROJECT} does not open: ${opened.message}`)
  return exportContent(opened.project)
}

const onDisk = (path: string): string | undefined => {
  try {
    return readFileSync(resolve(FOLDER, path), 'utf8')
  } catch {
    return undefined
  }
}

/** The paths whose checked-in file is missing or differs from a fresh export; empty when they all agree. */
export function templateContentDrift(): string[] {
  return exported()
    .filter((file) => onDisk(file.path) !== file.contents)
    .map((file) => file.path)
}

/** Writes every exported file over the checked-in one. */
export function writeTemplateContent(): void {
  for (const file of exported()) writeFileSync(resolve(FOLDER, file.path), file.contents)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const drift = templateContentDrift()
    for (const path of drift) console.error(`${path} differs from a fresh export of ${PROJECT}`)
    process.exitCode = drift.length === 0 ? 0 : 1
  } else writeTemplateContent()
}
