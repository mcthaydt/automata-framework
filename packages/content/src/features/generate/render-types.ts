// `content.d.ts`: typed access to compiled content (A0+A1 spec §5), so game code gets autocomplete and a
// type error for an ID that does not exist.
//
// Item types come from each schema through Zod's own `z.toJSONSchema` (output side), rendered to TypeScript
// for the shapes TOML content uses: objects, arrays, tuples, records, strings, numbers, booleans, enums,
// literals and unions. A `contentRef` becomes the ID union of its kind. Anything without a JSON form (a date,
// a custom check) becomes `unknown` with a comment naming the field, rather than a guessed type.

import { z } from 'zod'
import { type ContentSchemaDef, contentRefKinds, localizedTexts } from '../../shared/schema/content-schema'

export interface TypesInput {
  readonly schemas: readonly ContentSchemaDef[]
  /** Each collection kind's IDs, sorted. */
  readonly ids: ReadonlyMap<string, readonly string[]>
  readonly flow: { readonly screens: readonly string[]; readonly events: readonly string[] } | undefined
  readonly tuningNames: readonly string[]
  readonly hasGame: boolean
  readonly hasAssets: boolean
}

type JsonSchema = {
  readonly type?: string
  readonly const?: unknown
  readonly enum?: readonly unknown[]
  readonly anyOf?: readonly JsonSchema[]
  readonly oneOf?: readonly JsonSchema[]
  readonly items?: JsonSchema | false
  readonly prefixItems?: readonly JsonSchema[]
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties?: JsonSchema | boolean
  readonly 'x-automata-ref'?: string
}

/** `song` → `Song`, `weapon-kind` → `WeaponKind`. */
export const typeName = (kind: string): string =>
  kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const literal = (value: unknown): string =>
  typeof value === 'string' ? `'${value.replaceAll("'", "\\'")}'` : JSON.stringify(value)

const union = (members: readonly string[]): string => (members.length === 0 ? 'never' : members.join(' | '))

const propertyKey = (key: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : literal(key))

/** The JSON Schema of `schema`'s output, with references and localized text marked. */
function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  // Replaces the generated node in place: toJSONSchema hands the override the object it will emit.
  const replace = (target: Record<string, unknown>, value: Record<string, unknown>): void => {
    for (const key of Object.keys(target)) delete target[key]
    Object.assign(target, value)
  }
  return z.toJSONSchema(schema, {
    io: 'output',
    unrepresentable: 'any',
    override: (context) => {
      const ref = contentRefKinds.get(context.zodSchema as unknown as z.ZodType)
      if (ref !== undefined) replace(context.jsonSchema, { 'x-automata-ref': ref.kind })
      else if (localizedTexts.get(context.zodSchema as unknown as z.ZodType) !== undefined) {
        replace(context.jsonSchema, { type: 'string' })
      }
    },
  }) as JsonSchema
}

function render(node: JsonSchema, where: string, indent: string): string {
  const ref = node['x-automata-ref']
  if (ref !== undefined) return `${typeName(ref)}Id`
  if (node.const !== undefined) return literal(node.const)
  if (node.enum !== undefined) return union(node.enum.map(literal))
  const options = node.anyOf ?? node.oneOf
  if (options !== undefined) return union(options.map((option) => render(option, where, indent)))
  switch (node.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'array': {
      if (node.prefixItems !== undefined) {
        return `readonly [${node.prefixItems.map((item) => render(item, where, indent)).join(', ')}]`
      }
      const element = node.items === undefined || node.items === false ? {} : node.items
      const rendered = render(element, where, indent)
      return /[ |]/.test(rendered) ? `readonly (${rendered})[]` : `readonly ${rendered}[]`
    }
    case 'object': {
      if (node.properties === undefined) {
        const values =
          typeof node.additionalProperties === 'object'
            ? render(node.additionalProperties, where, indent)
            : 'unknown'
        return `Readonly<Record<string, ${values}>>`
      }
      const required = new Set(node.required ?? [])
      const inner = `${indent}  `
      const lines = Object.keys(node.properties)
        .sort()
        .map((key) => {
          const optional = required.has(key) ? '' : '?'
          const child = node.properties?.[key] ?? {}
          return `${inner}readonly ${propertyKey(key)}${optional}: ${render(child, `${where}.${key}`, inner)}`
        })
      return `{\n${lines.join('\n')}\n${indent}}`
    }
    default:
      return `unknown /* ${where} has no JSON form */`
  }
}

const TUNING_FIELD = '    readonly tuning: Readonly<Record<TuningName, number | boolean | string>>'

export function renderTypes(input: TypesInput): string {
  const lines: string[] = [
    '// Generated by @mcthaydt/automata-content from content/. Do not edit.',
    "declare module 'virtual:automata/content' {",
    "  import type { AssetsSource, FlowGraph, GameSource, Palette } from '@mcthaydt/automata-content'",
    '',
  ]
  const dataFields: string[] = []
  const simFields: string[] = []
  for (const def of input.schemas) {
    const name = typeName(def.kind)
    const shape = render(jsonSchemaOf(def.schema), def.kind, '  ')
    let field: string
    if ('folder' in def.place) {
      lines.push(`  export type ${name}Id = ${union((input.ids.get(def.kind) ?? []).map(literal))}`)
      field = `    readonly ${propertyKey(def.kind)}: Readonly<Record<${name}Id, ${name}>>`
    } else {
      field = `    readonly ${propertyKey(def.kind)}: ${name}`
    }
    dataFields.push(field)
    if (def.sim) simFields.push(field)
    lines.push(`  export type ${name} = ${shape}`, '')
  }
  lines.push(`  export type ScreenId = ${union((input.flow?.screens ?? []).map(literal))}`)
  lines.push(`  export type FlowEvent = ${union((input.flow?.events ?? []).map(literal))}`)
  lines.push(`  export type TuningName = ${union(input.tuningNames.map(literal))}`, '')
  lines.push('  export interface ContentData {')
  lines.push(...dataFields)
  lines.push(TUNING_FIELD)
  if (input.flow !== undefined) lines.push('    readonly flow: FlowGraph')
  lines.push('    readonly palette: Palette')
  if (input.hasGame) lines.push('    readonly game: GameSource')
  if (input.hasAssets) lines.push('    readonly assets: AssetsSource')
  lines.push('  }', '')
  // What the sim receives (M2.2 spec §3.3). A plain interface with no index signature, so a game's sim code
  // that casts `ctx.content as SimContentData` gets a type error for anything the sim does not hold.
  lines.push('  export interface SimContentData {')
  lines.push(TUNING_FIELD, ...simFields)
  lines.push('  }', '')
  lines.push('  export const content: ContentData', '  export const contentHash: string')
  lines.push('  export const simContent: SimContentData', '  export const simContentHash: string', '}', '')
  return lines.join('\n')
}
