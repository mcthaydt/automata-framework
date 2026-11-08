import { readFileSync } from 'node:fs'
import type { Finding } from './check.ts'
import { readImports } from './imports.ts'
import { collectPlatformSources } from './platform-imports.ts'

// The `--forbid` check: a package names other packages it may never import. The 2D editor package, for one, must not
// reach for 3D code, because the 3D editor depends on it and the build would loop. Tests and Svelte components count
// as well as src/, type-only imports too (a type still ties the two packages), and only real imports count, read
// from the AST, so a name in a string or a comment is not a break.

/** True when `specifier` is the package `name` or a path inside it (`@pixi/3d/extras`, not `@pixi/3d-lookalike`). */
function isPackage(specifier: string, name: string): boolean {
  return specifier === name || specifier.startsWith(`${name}/`)
}

/** The files checked and the findings, for one package folder and the package names it may not import. */
export function forbidFindings(
  packageRoot: string,
  forbidden: readonly string[],
): { files: string[]; findings: Finding[] } {
  const files = collectPlatformSources(packageRoot)
  const findings: Finding[] = []
  for (const file of files) {
    const { imports, errors } = readImports(file, readFileSync(file, 'utf8'))
    findings.push(...errors)
    for (const { specifier, line, col } of imports) {
      if (!forbidden.some((name) => isPackage(specifier, name))) continue
      findings.push({
        file,
        line,
        col,
        rule: 'forbidden-import',
        message: `imports "${specifier}", which ${packageRoot} may not use.`,
      })
    }
  }
  return { files, findings }
}
