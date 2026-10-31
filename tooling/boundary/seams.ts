// The F1 seams as Plus sees them (PRODUCT.1b; PRODUCT spec §2 F1): the framework lists what a paid extension plugs into in
// `tooling/api-report/src/seams.ts`, and each must be an `exports` entry of a core pack Plus installs. The list is read from
// the framework checkout at `core.ref` (.core/af), never copied here (one contract owner).

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publicCoreEntries } from './core-imports.ts'

/** The fields of the framework's `Seam` this check reads. */
export interface Seam {
  readonly seam: string
  readonly package: string
  readonly entryPoint: string
  readonly name: string
}

/** The framework's seams at the commit `core.ref` names. */
export async function loadSeams(root: string): Promise<readonly Seam[]> {
  const file = join(root, '.core', 'af', 'tooling', 'api-report', 'src', 'seams.ts')
  const loaded: { SEAMS?: readonly Seam[] } = await import(pathToFileURL(file).href)
  if (loaded.SEAMS === undefined) throw new Error(`${file} exports no SEAMS: run pnpm core:sync`)
  return loaded.SEAMS
}

/** `.` is the package name, `./x` is `name/x`: the specifier a Plus package would import. */
const specifierOf = (seam: Seam): string =>
  seam.entryPoint === '.' ? seam.package : `${seam.package}/${seam.entryPoint.slice(2)}`

/** One message per seam that is not a public entry of an installed core pack. */
export function seamFindings(root: string, seams: readonly Seam[]): string[] {
  const entries = publicCoreEntries(root)
  return seams
    .filter((seam) => !entries.has(specifierOf(seam)))
    .map(
      (seam) =>
        `seam "${seam.seam}" (${seam.name}): "${specifierOf(seam)}" is not a public entry of an installed core pack`,
    )
}
