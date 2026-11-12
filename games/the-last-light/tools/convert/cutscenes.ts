// The five cutscenes of the prologue, one file each, put on marks. October's fixture evaluated each script with Ada at one place; here
// three of them (`opening`, `lightsOut`, `rest`) start with Ada cut onto a mark, and the fourth (`found`) follows where
// she was caught. The lines, their timing and what they name are unchanged.
import { parse, stringify } from 'smol-toml'
import type { Converted, Unexpressed } from './report.ts'

/**
 * Each script is a file of its own (the `cutscene` kind: every TOML file in `content/cutscenes` is one script), named in
 * kebab-case as every content file is; the script keeps its own id (`lightsOut`), which the sim and the puzzle name.
 */
export const cutscenePath = (id: string): string =>
  `content/cutscenes/${id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.toml`

const HEADER =
  "# The prologue's cutscenes. They were converted once from the game's prologue at 92e6704 (through October's fixture),\n# and this file is now the source: edit it by hand and in Sequence.\n"

type Row = Record<string, unknown>
interface Script extends Row {
  id: string
  camera?: Row[]
  actor?: Row[]
}

/** Where Ada stands when `found` is evaluated in the fixture, and where the figure stood beside her. */
const FOUND_ADA = { x: 0.6, z: 3.6 }
const FOUND_FIGURE = { x: 0.13069499149142244, z: 2.832046349713237 }

/** A distance in metres, to the millimetre: an offset is not the float residue of two subtractions. */
const mm = (value: number): number => Math.round(value * 1000) / 1000

const near = (a: number | undefined, b: number): boolean => a !== undefined && Math.abs(a - b) < 1e-6

/** `opening`, `lightsOut` and `rest`: Ada's first key is the mark, arrived at with a cut. */
function putOnMark(script: Script, mark: { x: number; z: number }, report: Unexpressed[]): void {
  const first = script.actor?.find((key) => key.who === 'player')
  if (first === undefined) return
  if (!near(first.x as number | undefined, mark.x) || !near(first.z as number | undefined, mark.z))
    report.push({
      kind: 'cutscene',
      where: script.id,
      what: `Ada's first key moved onto the mark (${mark.x}, ${mark.z})`,
      did: 'approximated',
    })
  first.x = mark.x
  first.z = mark.z
  first.cut = true
}

/** `found`: the first shot hangs off Ada, her keys stand at her, and the figure stands where she caught her. */
function followWhereCaught(script: Script, report: Unexpressed[]): void {
  const cameras = script.camera ?? []
  const cutAt = cameras.findIndex((key, i) => i > 0 && key.cut === true)
  for (const key of cameras.slice(0, cutAt < 0 ? cameras.length : cutAt)) {
    const pos = key.pos as number[]
    const look = key.look as number[]
    key.about = 'player'
    key.pos = [mm((pos[0] as number) - FOUND_ADA.x), pos[1], mm((pos[2] as number) - FOUND_ADA.z)]
    key.look = [mm((look[0] as number) - FOUND_ADA.x), look[1], mm((look[2] as number) - FOUND_ADA.z)]
  }
  for (const key of script.actor ?? []) {
    if (
      key.who === 'player' &&
      near(key.x as number | undefined, FOUND_ADA.x) &&
      near(key.z as number | undefined, FOUND_ADA.z)
    ) {
      delete key.x
      delete key.z
      key.at = 'player'
    } else if (
      key.who === 'nurse' &&
      near(key.x as number | undefined, FOUND_FIGURE.x) &&
      near(key.z as number | undefined, FOUND_FIGURE.z)
    ) {
      delete key.x
      delete key.z
      key.at = 'actor:nurse'
    }
  }
  report.push({
    kind: 'cutscene',
    where: 'found',
    what: 'the old step to 0.9 m beside Ada (moved, clearSpot, sees) and the lens fitted to distance (fit)',
    did: 'dropped',
  })
}

/** The cutscenes file, with each script put on its mark. */
export function restageCutscenes(
  cutscenes: string,
  marks: Readonly<Record<string, { x: number; z: number }>>,
): Converted {
  const file = parse(cutscenes) as { cutscenes: Script[] }
  const report: Unexpressed[] = []
  for (const script of file.cutscenes) {
    const mark = marks[script.id]
    if (mark !== undefined) putOnMark(script, mark, report)
    else if (script.id === 'found') followWhereCaught(script, report)
  }
  const files = Object.fromEntries(
    file.cutscenes.map((script) => [cutscenePath(script.id), `${HEADER}${stringify(script)}\n`]),
  )
  return { files, report }
}
