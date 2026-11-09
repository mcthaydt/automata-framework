// Writes the starter pictures a new game starts with (`template-content/assets/*.png`): the terrain, the player, a coin
// and a slime. They are made from code, so the same run gives the same bytes and a test keeps them equal:
//   node scripts/write-starter-art.ts           writes the pictures
//   node scripts/write-starter-art.ts --check   lists the pictures that differ, and fails if any does
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coinSheet, playerSheet, slimeSheet } from './starter-art/characters.ts'
import { encodePng } from './starter-art/png.ts'
import { type GroundRule, terrainSheet } from './starter-art/terrain.ts'

const FOLDER = fileURLToPath(new URL('../src/shared/create-game/template-content/', import.meta.url))
const PROJECT = resolve(FOLDER, 'levels/start.af2d.json')

/** The ground group's rules in the starter level's project: what the terrain's tiles are drawn to match. */
function groundRules(): GroundRule[] {
  const project = JSON.parse(readFileSync(PROJECT, 'utf8')) as {
    defs: { layers: { id: string; groups?: { rules: GroundRule[] }[] }[] }
  }
  return (
    project.defs.layers.find((layer) => layer.id === 'ground')?.groups?.flatMap((group) => group.rules) ?? []
  )
}

/** The pictures, by their path under `template-content/`. */
export function starterArt(): readonly { readonly path: string; readonly bytes: Buffer }[] {
  return [
    { path: 'assets/terrain.png', bytes: encodePng(terrainSheet(groundRules())) },
    { path: 'assets/player.png', bytes: encodePng(playerSheet()) },
    { path: 'assets/coin.png', bytes: encodePng(coinSheet()) },
    { path: 'assets/slime.png', bytes: encodePng(slimeSheet()) },
  ]
}

const onDisk = (path: string): Buffer | undefined => {
  try {
    return readFileSync(resolve(FOLDER, path))
  } catch {
    return undefined
  }
}

/** The pictures whose checked-in file is missing or differs from a fresh run. */
export function starterArtDrift(): string[] {
  return starterArt()
    .filter((file) => onDisk(file.path)?.equals(file.bytes) !== true)
    .map((file) => file.path)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const drift = starterArtDrift()
    for (const path of drift)
      console.error(`${path} differs from a fresh run of scripts/write-starter-art.ts`)
    process.exitCode = drift.length === 0 ? 0 : 1
  } else {
    mkdirSync(resolve(FOLDER, 'assets'), { recursive: true })
    for (const file of starterArt()) writeFileSync(resolve(FOLDER, file.path), file.bytes)
  }
}
