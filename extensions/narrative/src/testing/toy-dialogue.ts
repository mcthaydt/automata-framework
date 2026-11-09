// Toy conversations for the dialogue tools' tests: a tiny story with a porter, a player and a register.
import type { Canon } from '../shared/sim/canon.schema'
import type { DialogueGraph } from '../shared/sim/dialogue.schema'
import type { LineKind, LineRecord } from '../shared/sim/lines.schema'

export const rec = (
  id: string,
  speaker: string | null,
  text: string,
  extra: Partial<LineRecord> = {},
): { record: LineRecord; text: string } => ({
  record: { id, kind: 'dialogue' as LineKind, ...(speaker === null ? {} : { speaker }), text: id, ...extra },
  text,
})
const LINES = [
  rec('toy.hello', 'porter', 'Cold tonight. The river is high.'),
  rec('toy.ask', 'porter', 'Who are you, then?'),
  rec('toy.duty', 'ada', 'Staff. I’m on nights.'),
  rec('toy.unsure', 'ada', 'I don’t know yet.'),
  rec('toy.yours', 'ada', 'I think I’m for you.'),
  rec('toy.bye', 'porter', 'First light at 06:02, then.'),
  rec('toy.warm', 'porter', 'You are warm. Stay a while.'),
]
export const RECORDS: LineRecord[] = LINES.map((l) => l.record)
export const TEXT: Record<string, string> = Object.fromEntries(LINES.map((l) => [l.record.id, l.text]))
export const withLines = (
  ...more: { record: LineRecord; text: string }[]
): { records: LineRecord[]; text: Record<string, string> } => ({
  records: [...RECORDS, ...more.map((m) => m.record)],
  text: { ...TEXT, ...Object.fromEntries(more.map((m) => [m.record.id, m.text])) },
})

/** A conversation: two lines, three answers that join again, a line only a warm player hears, one exit. */
export const TALK: DialogueGraph = {
  id: 'meet',
  speaker: 'porter',
  start: 'open',
  nodes: {
    open: {
      say: ['toy.hello', 'toy.ask'],
      choices: [
        { line: 'toy.duty', stance: -1, next: 'join' },
        { line: 'toy.unsure', next: 'join' },
        { line: 'toy.yours', stance: 1, set: { metPorter: true }, next: 'join' },
      ],
    },
    join: { say: [], next: 'warm' },
    warm: { say: ['toy.warm'], when: [{ fact: 'light', is: 'lighter' }], next: 'bye' },
    bye: { say: ['toy.bye'] },
  },
}
/** A canon with the stance axis and motifs the tools read; the rest is empty. */
export const CANON: Canon = {
  people: {},
  places: {},
  times: {},
  numbers: {},
  facts: [],
  tone: { banned: [], style: '' },
  glossary: [],
  motifs: ['four', 'clocks', 'pools'],
  stance: { min: -4, max: 4 },
}
