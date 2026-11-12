import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import ts from 'typescript'

/**
 * Whether the file a `publishConfig` export names is in the package. A subpath pattern (`./words/*.json`) names
 * every file its `*` matches, so it is there when at least one file in its folder matches; the pattern is not a
 * file name to look up.
 */
export function publishedFileExists(packageDir: string, file: string): boolean {
  if (!file.includes('*')) return existsSync(join(packageDir, file))
  const folder = join(packageDir, dirname(file))
  if (!existsSync(folder)) return false
  const [before = '', after = ''] = basename(file).split('*')
  return readdirSync(folder).some(
    (name) => name.length >= before.length + after.length && name.startsWith(before) && name.endsWith(after),
  )
}

export interface RelativeImport {
  readonly specifier: string
  /** The import ends in `with { type: 'json' }`, which Node's loader requires for a JSON module. */
  readonly jsonAttribute: boolean
}

const isRelative = (specifier: string): boolean => /^\.{1,2}\//.test(specifier)

/**
 * Every relative module a file imports: `import … from`, `export … from`, `import './x'`, `import('./x')` and a
 * declaration file's `import('./x').T`. It reads the file's syntax tree, so a doc comment's example, an import a
 * template literal writes for the game it generates, and a stray backtick in a comment are not taken for imports.
 */
export function relativeImports(code: string, fileName = 'file.js'): RelativeImport[] {
  const found: RelativeImport[] = []
  const add = (
    specifier: ts.Expression | ts.TypeNode | undefined,
    attributes?: ts.ImportAttributes,
  ): void => {
    if (specifier === undefined) return
    const literal = ts.isLiteralTypeNode(specifier) ? specifier.literal : specifier
    if (!ts.isStringLiteralLike(literal) || !isRelative(literal.text)) return
    const jsonAttribute = attributes?.elements.some(
      (element) =>
        (ts.isIdentifier(element.name) ? element.name.text : (element.name as ts.StringLiteral).text) ===
          'type' &&
        ts.isStringLiteralLike(element.value) &&
        element.value.text === 'json',
    )
    found.push({ specifier: literal.text, jsonAttribute: jsonAttribute === true })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      add(node.moduleSpecifier, node.attributes)
    else if (ts.isImportTypeNode(node)) add(node.argument, node.attributes)
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    )
      add(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true))
  return found
}
