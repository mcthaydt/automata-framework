// Reads, from a checkout of the game's old repository, the two things the fixtures do not hold: where the furniture
// stands (the clinic's prop table) and how the lines are said (the prologue's delivery table). Both are TypeScript there,
// with a little arithmetic in them, so they are read as text; a line this cannot read is an error that names it, never a
// guess. Used once, by `convert.ts --reference <path>`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OldDelivery } from './lines.ts'
import type { PlacedModel } from './props-table.ts'

/** The numbers an old expression may name. */
const CONSTANTS: Readonly<Record<string, number>> = { 'Math.PI': Math.PI }

/** An arithmetic expression of numbers, `+ - * /`, parentheses and named constants, evaluated without `eval`. */
export function evaluate(expression: string, names: Readonly<Record<string, number>> = {}): number {
  const all = { ...CONSTANTS, ...names }
  const tokens = expression.match(/[A-Za-z_][\w.]*|\d+\.?\d*|\.\d+|[()+\-*/]/g) ?? []
  let at = 0
  const peek = () => tokens[at]
  const take = () => tokens[at++]
  function atom(): number {
    const token = take()
    if (token === undefined) throw new Error(`Cannot read "${expression}".`)
    if (token === '(') {
      const inner = sum()
      take()
      return inner
    }
    if (token === '-') return -atom()
    if (/^[\d.]/.test(token)) return Number(token)
    const named = all[token]
    if (named === undefined) throw new Error(`Cannot read "${expression}": no number named ${token}.`)
    return named
  }
  function product(): number {
    let value = atom()
    while (peek() === '*' || peek() === '/') value = take() === '*' ? value * atom() : value / atom()
    return value
  }
  function sum(): number {
    let value = product()
    while (peek() === '+' || peek() === '-') value = take() === '+' ? value + product() : value - product()
    return value
  }
  const result = sum()
  if (at < tokens.length) throw new Error(`Cannot read "${expression}".`)
  return result
}

/** The boxes of the old level by id, with where each stands. */
export function boxesIn(levelSource: string): Readonly<Record<string, { x: number; z: number }>> {
  const boxes: Record<string, { x: number; z: number }> = {}
  for (const match of levelSource.matchAll(/\{\s*id:\s*'([^']+)',\s*x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)/g))
    if (!Object.hasOwn(boxes, match[1] as string))
      boxes[match[1] as string] = { x: Number(match[2]), z: Number(match[3]) }
  return boxes
}

/** The wall-face constants of the old prop table. */
function wallFaces(source: string): Record<string, number> {
  const block = /WALL_FACE\s*=\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''
  const out: Record<string, number> = {}
  for (const [, name, value] of block.matchAll(/(\w+):\s*(-?[\d.]+)/g))
    out[`WALL_FACE.${name}`] = Number(value)
  return out
}

/** The value of a field `name:` in one entry's text, as an expression. */
function fieldOf(entry: string, name: string): string | undefined {
  return new RegExp(`(?:^|[\\s,{])${name}:\\s*([^,]+?(?:\\([^)]*\\))?[^,]*)(?=,|\\s*\\}|$)`)
    .exec(entry)?.[1]
    ?.trim()
}

/** The furniture the old clinic's prop table placed, in order. */
export function placedModelsIn(propsSource: string, levelSource: string): PlacedModel[] {
  const boxes = boxesIn(levelSource)
  const names = wallFaces(propsSource)
  const table = /export const PROPS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(propsSource)?.[1] ?? ''
  const models: PlacedModel[] = []
  for (const rawLine of table.split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '').trim()
    const stock = /^\.\.\.stock\('(\w+)',\s*([-\d.]+),\s*([-\d.]+),\s*\[(.*)\]\),?$/.exec(line)
    if (stock !== null) {
      const wall = stock[1] as string
      const yaw = wall === 'north' ? 0 : wall === 'west' ? Math.PI / 2 : -Math.PI / 2
      for (const item of (stock[4] as string).matchAll(/\['([\w-]+)',\s*([\d.]+),\s*([\d.]+)\]/g))
        models.push({
          file: item[1] as string,
          x: Number(stock[2]),
          z: Number(stock[3]),
          y: Math.round((Number(item[2]) + 0.02) * 1000) / 1000,
          yaw,
          size: [0.3, Number(item[3]), 0.3],
        })
      continue
    }
    if (!line.startsWith('{ file:')) continue
    const file = /file:\s*'([^']+)'/.exec(line)?.[1]
    const size = /size:\s*\[([^\]]+)\]/
      .exec(line)?.[1]
      ?.split(',')
      .map((part) => evaluate(part.trim(), names))
    if (file === undefined || size?.length !== 3) throw new Error(`Cannot read the prop line: ${line}`)
    const at = /\.\.\.at\('([^']+)'\)/.exec(line)?.[1]
    const box = at === undefined ? undefined : boxes[at]
    if (at !== undefined && box === undefined)
      throw new Error(`The prop ${file} stands on a box "${at}" the level lacks.`)
    const x = fieldOf(line, 'x')
    const z = fieldOf(line, 'z')
    const y = fieldOf(line, 'y')
    const yaw = fieldOf(line, 'yaw')
    models.push({
      file,
      x: x === undefined ? (box?.x as number) : evaluate(x, names),
      z: z === undefined ? (box?.z as number) : evaluate(z, names),
      ...(y === undefined ? {} : { y: evaluate(y, names) }),
      ...(yaw === undefined ? {} : { yaw: evaluate(yaw, names) }),
      size: [size[0] as number, size[1] as number, size[2] as number],
      ...(at === undefined ? {} : { collider: at }),
    })
  }
  return models
}

/** The prologue's delivery table: line id → how, pace, say. */
export function deliveryIn(source: string): OldDelivery {
  const table: Record<string, { how?: string; pace?: number; say?: string }> = {}
  for (const match of source.matchAll(/^\s*'([^']+)':\s*\{(.*)\},?\s*$/gm)) {
    const body = match[2] as string
    const how = /how:\s*'((?:[^'\\]|\\.)*)'/.exec(body)?.[1]
    const pace = /pace:\s*([\d.]+)/.exec(body)?.[1]
    const say = /say:\s*'((?:[^'\\]|\\.)*)'/.exec(body)?.[1]
    table[match[1] as string] = {
      ...(how === undefined ? {} : { how }),
      ...(pace === undefined ? {} : { pace: Number(pace) }),
      ...(say === undefined ? {} : { say: say.replace(/\\'/g, "'") }),
    }
  }
  return table
}

/** Reads both tables from a checkout. */
export function readReference(reference: string): { models: PlacedModel[]; delivery: OldDelivery } {
  const read = (path: string) => readFileSync(join(reference, path), 'utf8')
  return {
    models: placedModelsIn(read('src/scenes/clinic/props.ts'), read('src/scenes/prologue/level.ts')),
    delivery: deliveryIn(read('src/scenes/prologue/delivery.ts')),
  }
}
