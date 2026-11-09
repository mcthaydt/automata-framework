// The words around the plan (ED3D.5d; ED3D spec §9): the status line, the checks pill and the mode switch. They are for
// someone who is not a developer (Owner, 2026-10-30): a sector is a room, a wall is counted from 1, a disabled mode says
// why, and nothing names a task or a file format. Plain functions, so each wording is a unit test.
import type { Point } from '@automata/3d/level'
import { parseSelection } from '../../../shared/edit/selection-ref'
import type { ViewMode } from '../../../shared/edit/view-store'

/** A number with two decimals and a real minus sign. */
const metres = (value: number): string => {
  const text = (Math.round(value * 100) / 100 + 0).toFixed(2)
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

function selectionWords(selection: readonly string[]): string {
  if (selection.length === 0) return 'Nothing selected'
  if (selection.length > 1) return `${selection.length} things selected`
  const ref = parseSelection(selection[0] ?? '')
  if (ref === undefined) return '1 thing selected'
  if (ref.kind === 'sector') return `Room ${ref.sector} selected`
  if (ref.kind === 'wall') return `Wall ${ref.corner + 1} of ${ref.sector} selected`
  return `${ref.definition} ${ref.id} selected`
}

export interface PlanStatusInput {
  /** The pointer on the plan, in metres; `undefined` when it is off the plan. */
  readonly pointer: Point | undefined
  readonly pxPerMetre: number
  readonly selection: readonly string[]
  /** A phone's short line: the selection alone, so the save state beside it stays in view. */
  readonly brief?: boolean | undefined
}

export function planStatus(input: PlanStatusInput): string {
  if (input.brief === true) return selectionWords(input.selection)
  const parts: string[] = []
  if (input.pointer !== undefined)
    parts.push(`x ${metres(input.pointer.x)} m`, `z ${metres(input.pointer.z)} m`)
  parts.push(`${Math.round(input.pxPerMetre)} px per metre`, selectionWords(input.selection))
  return parts.join(' · ')
}

export type PillTone = 'ok' | 'warn' | 'bad' | 'neutral'

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** The checks pill: errors are "problems", the word a checks list uses for what blocks shipping. */
export function checksWords(counts: {
  readonly errors: number
  readonly warnings: number
  readonly pending: boolean
}): { readonly text: string; readonly tone: PillTone } {
  if (counts.pending) return { text: 'Checking…', tone: 'neutral' }
  const warnings = plural(counts.warnings, 'warning', 'warnings')
  if (counts.errors > 0) {
    const problems = plural(counts.errors, 'problem', 'problems')
    return { text: counts.warnings > 0 ? `${problems} · ${warnings}` : problems, tone: 'bad' }
  }
  if (counts.warnings > 0) return { text: warnings, tone: 'warn' }
  return { text: 'No problems', tone: 'ok' }
}

export interface ModeOption {
  readonly id: ViewMode
  readonly label: string
  readonly disabled?: boolean
  readonly reason?: string
}

/**
 * The views of the top bar. World says it is coming, in words. Below `wide` (`narrow`) the bar offers Plan, 3D and Walk:
 * Split needs the width, and the 3D modes replace Plan there (ED3D spec §10; ED3D.5f, ED3D.8b).
 */
export function modeOptions({ narrow = false }: { readonly narrow?: boolean } = {}): readonly ModeOption[] {
  if (narrow)
    return [
      { id: 'plan', label: 'Plan' },
      { id: 'dollhouse', label: '3D' },
      { id: 'walk', label: 'Walk' },
    ]
  const coming = (id: ViewMode, label: string, what: string): ModeOption => ({
    id,
    label,
    disabled: true,
    reason: `Not ready yet: ${what}`,
  })
  return [
    { id: 'plan', label: 'Plan' },
    { id: 'split', label: 'Split' },
    { id: 'dollhouse', label: '3D' },
    { id: 'walk', label: 'Walk' },
    coming('world', 'World', 'the map of all your levels is coming soon.'),
  ]
}
