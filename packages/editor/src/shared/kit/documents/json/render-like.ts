// Writing a new value into a file the way its neighbours are written: inline when the sibling it copies is on one
// line, one member per line (packed, when the sibling packs them) when it is not.
import { indentAt, PACK_WIDTH, sameLine } from './layout'
import type { JsonNode } from './locate'
import { formatJsonScalar, type NumberStyle } from './print'
import { child, isMultiline, itemEnd, itemStart, type JsonValue, memberName, type Source } from './shape'

function inline(value: JsonValue, bracesSpaced: boolean, numbers: NumberStyle): string {
  if (Array.isArray(value)) return `[${value.map((item) => inline(item, bracesSpaced, numbers)).join(', ')}]`
  if (value !== null && typeof value === 'object') {
    const body = Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${inline(item, bracesSpaced, numbers)}`)
      .join(', ')
    if (!body) return '{}'
    return bracesSpaced ? `{ ${body} }` : `{${body}}`
  }
  return formatJsonScalar(value, numbers)
}

function expanded(value: JsonValue, indent: string, unit: string, numbers: NumberStyle): string {
  const inner = indent + unit
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((item) => inner + expanded(item, inner, unit, numbers)).join(',\n')}\n${indent}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const lines = entries.map(
      ([key, item]) => `${inner}${JSON.stringify(key)}: ${expanded(item, inner, unit, numbers)}`,
    )
    return `{\n${lines.join(',\n')}\n${indent}}`
  }
  return formatJsonScalar(value, numbers)
}

/** Lines of items: each multi-line item alone; single-line ones packed up to PACK_WIDTH when `packed`, else one per line. */
function lines(items: string[], indent: string, packed: boolean): string {
  const out: string[] = []
  let current = ''
  for (const item of items) {
    if (!packed || item.includes('\n')) {
      if (current) out.push(current)
      current = ''
      out.push(indent + item)
      continue
    }
    if (current && current.length + 2 + item.length > PACK_WIDTH) {
      out.push(current)
      current = ''
    }
    current = current ? `${current}, ${item}` : indent + item
  }
  if (current) out.push(current)
  return out.join(',\n')
}

/**
 * `value` written like `template` (a node of the file of the same kind): inline if the template is one line, else laid
 * out member by member the way the template is, each member like the template's member of the same name (an array
 * element like the template's element at that index, or its last). With no template, the file's default.
 */
export function render(
  source: Source,
  value: JsonValue,
  template: JsonNode | undefined,
  indent: string,
): string {
  const { text, layout, numbers } = source
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  if (!isObject && !isArray) return formatJsonScalar(value, numbers)
  if (!template || template.kind !== (isObject ? 'object' : 'array')) {
    return layout.expandsEverything
      ? expanded(value, indent, layout.unit, numbers)
      : inline(value, layout.bracesSpaced, numbers)
  }
  if (!isMultiline(source, template)) {
    const written = text.slice(template.span.start, template.span.end)
    const spaced = /\{ "/.test(written) ? true : /\{"/.test(written) ? false : layout.bracesSpaced
    return inline(value, spaced, numbers)
  }
  const closeIndent = indentAt(text, template.span.end - 1)
  const members = template.children
  const first = members[0]
  const inner = first ? indentAt(text, itemStart(first)) : closeIndent + layout.unit
  const packed = members.some(
    (member, i) => i > 0 && sameLine(text, itemEnd(child(template, i - 1)), itemStart(member)),
  )
  if (isObject) {
    const byName = new Map(members.map((member) => [memberName(member), member]))
    const entries = Object.entries(value as Record<string, JsonValue>)
    if (!entries.length) return '{}'
    const items = entries.map(
      ([key, item]) => `${JSON.stringify(key)}: ${render(source, item, byName.get(key), inner)}`,
    )
    return `{\n${lines(items, inner, packed)}\n${indent}}`
  }
  const elements = value as JsonValue[]
  if (!elements.length) return '[]'
  const items = elements.map((item, i) =>
    render(source, item, members[Math.min(i, members.length - 1)], inner),
  )
  return `[\n${lines(items, inner, packed)}\n${indent}]`
}
