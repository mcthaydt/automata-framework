import { readFileSync } from 'node:fs'
import type { Finding, Rule } from './check.ts'
import { readImports } from './imports.ts'
import { collectPlatformSources } from './platform-imports.ts'

// The `--forbid` check: a package names the packages it may never import (the 2D editor and `@pixi/3d`), so one
// dimension cannot leak into another's package. Every source under the package counts, tests and Svelte components
// included, and so do type-only imports, which tie the package to the other one all the same. A name in a string
// or a comment is not an import (the same reader as the platform check).

/** True when `specifier` is `name` or a path inside it (`@pixi/3d` matches `@pixi/3d/loader`, not `@pixi/3d-extras`). */
function names(specifier: string, name: string): boolean {
  return specifier === name || specifier.startsWith(`${name}/`)
}

/** The rule name and message of a finding: `--forbid` words it about the package, other checks word their own. */
export interface ForbidReport {
  readonly rule: Rule
  readonly message: (specifier: string, packageRoot: string) => string
}

const FORBID_REPORT: ForbidReport = {
  rule: 'forbidden-import',
  message: (specifier, packageRoot) => `imports "${specifier}", which ${packageRoot} may not use.`,
}

/** The files checked and the findings for one package folder and the packages it may not import. */
export function forbidFindings(
  packageRoot: string,
  forbidden: readonly string[],
  report: ForbidReport = FORBID_REPORT,
): { files: string[]; findings: Finding[] } {
  const files = collectPlatformSources(packageRoot)
  const findings: Finding[] = []
  for (const file of files) {
    const { imports, errors } = readImports(file, readFileSync(file, 'utf8'))
    findings.push(...errors)
    for (const { specifier, line, col } of imports) {
      if (!forbidden.some((name) => names(specifier, name))) continue
      findings.push({
        file,
        line,
        col,
        rule: report.rule,
        message: report.message(specifier, packageRoot),
      })
    }
  }
  return { files, findings }
}
