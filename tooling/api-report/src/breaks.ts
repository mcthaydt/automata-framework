// The API break check (PRODUCT spec §2 F6). A break is an entry point or export that is gone, or an export
// whose declaration changed: any change counts, since adding a member to an interface breaks the code that
// implements it. Additions are not breaks, and neither is a function that only gains optional trailing
// parameters: no caller can have implemented a function. A break must be declared by a changeset for its package:
// before 1.0 every AF changeset is a patch (04, M2.4 spec §2; `check-changesets.ts`), so a patch with a
// `BREAKING:` line declares it; from 1.0 only a `major` does. The M8 spec adds the codemod requirement.
import ts from 'typescript'
import { readChangeset } from '../../release/src/check-changesets.ts'
import type { ApiEntry, ApiExport } from './extract.ts'
import type { ParsedReport } from './report.ts'

export interface ApiBreak {
  readonly package: string
  readonly entryPoint: string
  /** The export; undefined when the whole entry point is gone. */
  readonly name: string | undefined
  readonly change: 'removed' | 'changed'
}

/** The one function signature a declaration holds, or undefined for overloads or anything else. */
function singleFunction(declaration: string): ts.FunctionDeclaration | undefined {
  const file = ts.createSourceFile('declaration.d.ts', declaration, ts.ScriptTarget.Latest, true)
  const [only, ...rest] = file.statements
  return rest.length === 0 && only !== undefined && ts.isFunctionDeclaration(only) ? only : undefined
}

const texts = (nodes: readonly ts.Node[] | undefined): string[] => (nodes ?? []).map((node) => node.getText())

/**
 * Whether `head` is `base` with optional parameters appended: the same name, type parameters and return type, the
 * same leading parameters, and every extra parameter optional (a rest parameter is not). Compared as written, so
 * a renamed or retyped parameter is a change even when callers would not notice.
 */
function onlyAppendsOptionalParameters(base: ApiExport, head: ApiExport): boolean {
  if (base.kind !== 'function' || head.kind !== 'function') return false
  const before = singleFunction(base.declaration)
  const after = singleFunction(head.declaration)
  if (before === undefined || after === undefined) return false
  const same =
    before.name?.getText() === after.name?.getText() &&
    before.type?.getText() === after.type?.getText() &&
    texts(before.typeParameters).join(',') === texts(after.typeParameters).join(',')
  if (!same || after.parameters.length < before.parameters.length) return false
  const kept = before.parameters.every(
    (parameter, index) => parameter.getText() === after.parameters[index]?.getText(),
  )
  return (
    kept &&
    after.parameters
      .slice(before.parameters.length)
      .every((parameter) => parameter.questionToken !== undefined && parameter.dotDotDotToken === undefined)
  )
}

/** Every break from `base` (the report on the base branch) to `head` (the current API), in report order. */
export function apiBreaks(base: ParsedReport, head: { readonly entries: readonly ApiEntry[] }): ApiBreak[] {
  const breaks: ApiBreak[] = []
  for (const baseEntry of base.entries) {
    const headEntry = head.entries.find((entry) => entry.entryPoint === baseEntry.entryPoint)
    if (headEntry === undefined) {
      breaks.push({
        package: base.package,
        entryPoint: baseEntry.entryPoint,
        name: undefined,
        change: 'removed',
      })
      continue
    }
    for (const baseExport of baseEntry.exports) {
      const headExport = headEntry.exports.find((exported) => exported.name === baseExport.name)
      if (
        headExport === undefined ||
        (headExport.declaration !== baseExport.declaration &&
          !onlyAppendsOptionalParameters(baseExport, headExport))
      ) {
        breaks.push({
          package: base.package,
          entryPoint: baseEntry.entryPoint,
          name: baseExport.name,
          change: headExport === undefined ? 'removed' : 'changed',
        })
      }
    }
  }
  return breaks
}

const BREAKING_LINE = /^BREAKING(?: CHANGE)?:/m

function majorOf(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '0', 10)
}

/** The breaks no changeset in `changesets` (file name to text) declares; `versions` by package name. */
export function undeclaredBreaks(
  breaks: readonly ApiBreak[],
  changesets: Readonly<Record<string, string>>,
  versions: Readonly<Record<string, string>>,
): ApiBreak[] {
  const read = Object.values(changesets).flatMap((text) => {
    const changeset = readChangeset(text)
    return changeset === undefined ? [] : [changeset]
  })
  const declared = (name: string) => {
    const beforeOne = majorOf(versions[name] ?? '0.0.0') < 1
    return read.some((changeset) =>
      changeset.releases.some(
        (release) =>
          release.name === name &&
          (release.bump === 'major' || (beforeOne && BREAKING_LINE.test(changeset.body))),
      ),
    )
  }
  return breaks.filter((found) => !declared(found.package))
}

/** One line per break, for the CLI. */
export function describeBreak(found: ApiBreak): string {
  const where = found.name === undefined ? found.entryPoint : `${found.entryPoint} ${found.name}`
  return `${found.package} ${where}: ${found.change}`
}
