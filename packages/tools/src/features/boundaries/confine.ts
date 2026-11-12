import { resolve, sep } from 'node:path'
import { type ForbidReport, forbidFindings } from './forbid.ts'

// The `--confine` check: a package that only one folder, its door, may import. The figure painter is private and
// reached by games only through the character kit's door, so nothing else under the roots (tests included) may import
// it, even with the dependency declared. It is the `--forbid` reader with the door exempt, so a name in a string is
// not an import and a lookalike package (`@x/painter-extras`) is not the package.

/** True when `file` is the folder `door` or lies inside it (`door-2` is not inside `door`). */
function inside(file: string, door: string): boolean {
  const path = resolve(file)
  return path === door || path.startsWith(`${door}${sep}`)
}

/** The findings for every source under `roots` outside `door` that imports `packageName` (or a path inside it). */
export function confineFindings(
  roots: readonly string[],
  packageName: string,
  door: string,
): { files: string[]; findings: ReturnType<typeof forbidFindings>['findings'] } {
  const report: ForbidReport = {
    rule: 'confined-import',
    message: (specifier) => `imports "${specifier}", which only ${door} may use.`,
  }
  const resolved = resolve(door)
  const results = roots.map((root) =>
    forbidFindings(root, [packageName], report, (file) => inside(file, resolved)),
  )
  return { files: results.flatMap((r) => r.files), findings: results.flatMap((r) => r.findings) }
}
