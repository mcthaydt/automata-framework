// Renaming a font's family inside its `name` table.
//
// The SIL Open Font License lets a subset (a Modified Version) keep the font's copyright and licence notices, but not a
// Reserved Font Name. A subset's name table still carries the family in several records (family, full name, PostScript
// name, unique id), so a font whose licence reserves its name is rewritten here: its family records say the new name,
// a record that names the reserved name anywhere else is dropped, and the copyright and licence records are kept
// byte for byte. This is a small, exact rewrite of one table of an sfnt file (TrueType or OpenType), and every other
// table is copied as it is, so the glyphs do not move.

/** The `name` records the OFL says to keep as they are: the copyright (0), and the licence text (13) and address (14). */
const KEPT = new Set([0, 13, 14])
const FAMILY = 1
const FULL_NAME = 4
const POSTSCRIPT = 6
const UNIQUE = 3
const TYPOGRAPHIC_FAMILY = 16

/** The `name` records every renamed font is asked to keep: all the standard ones, so none is lost to a default cut. */
export const NAME_IDS: readonly number[] = Array.from({ length: 18 }, (_, id) => id)

interface NameRecord {
  readonly platform: number
  readonly encoding: number
  readonly language: number
  readonly id: number
  readonly bytes: Uint8Array
}

const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

/** Platform 0 and 3 store UTF-16 big endian; the old Macintosh platform stores single bytes, read here as Latin 1. */
function decode(record: NameRecord): string {
  if (record.platform === 1) return String.fromCharCode(...record.bytes)
  let text = ''
  for (let at = 0; at + 1 < record.bytes.length; at += 2)
    text += String.fromCharCode(((record.bytes[at] as number) << 8) | (record.bytes[at + 1] as number))
  return text
}

function utf16(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2)
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index)
    bytes[index * 2] = unit >> 8
    bytes[index * 2 + 1] = unit & 0xff
  }
  return bytes
}

const windowsEnglish = (id: number, text: string): NameRecord => ({
  platform: 3,
  encoding: 1,
  language: 0x409,
  id,
  bytes: utf16(text),
})

/** The `name` table's records, and the table's text for each. */
function readRecords(table: Uint8Array): NameRecord[] {
  const data = view(table)
  const count = data.getUint16(2)
  const strings = data.getUint16(4)
  const records: NameRecord[] = []
  for (let index = 0; index < count; index++) {
    const at = 6 + index * 12
    const length = data.getUint16(at + 8)
    const offset = strings + data.getUint16(at + 10)
    records.push({
      platform: data.getUint16(at),
      encoding: data.getUint16(at + 2),
      language: data.getUint16(at + 4),
      id: data.getUint16(at + 6),
      bytes: table.slice(offset, offset + length),
    })
  }
  return records
}

/** A format 0 `name` table holding exactly these records, sorted as the format requires. */
function writeRecords(records: readonly NameRecord[]): Uint8Array {
  const sorted = [...records].sort(
    (a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id,
  )
  const stringsAt = 6 + sorted.length * 12
  const total = sorted.reduce((sum, record) => sum + record.bytes.length, 0)
  const out = new Uint8Array(stringsAt + total)
  const data = view(out)
  data.setUint16(2, sorted.length)
  data.setUint16(4, stringsAt)
  let offset = 0
  sorted.forEach((record, index) => {
    const at = 6 + index * 12
    data.setUint16(at, record.platform)
    data.setUint16(at + 2, record.encoding)
    data.setUint16(at + 4, record.language)
    data.setUint16(at + 6, record.id)
    data.setUint16(at + 8, record.bytes.length)
    data.setUint16(at + 10, offset)
    out.set(record.bytes, stringsAt + offset)
    offset += record.bytes.length
  })
  return out
}

/** The sum of a table's big-endian 32-bit words, the last one padded with zeros. */
function checksum(bytes: Uint8Array): number {
  let sum = 0
  for (let at = 0; at < bytes.length; at += 4) {
    const word =
      ((bytes[at] as number) << 24) |
      ((bytes[at + 1] ?? 0) << 16) |
      ((bytes[at + 2] ?? 0) << 8) |
      (bytes[at + 3] ?? 0)
    sum = (sum + (word >>> 0)) >>> 0
  }
  return sum
}

interface Table {
  readonly tag: string
  readonly bytes: Uint8Array
}

/** An sfnt file's tables by tag, in the file's own order. */
function readTables(font: Uint8Array): { version: number; tables: Table[] } {
  const data = view(font)
  const count = data.getUint16(4)
  const tables: Table[] = []
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16
    const tag = String.fromCharCode(
      font[at] as number,
      font[at + 1] as number,
      font[at + 2] as number,
      font[at + 3] as number,
    )
    const offset = data.getUint32(at + 8)
    tables.push({ tag, bytes: font.slice(offset, offset + data.getUint32(at + 12)) })
  }
  return { version: data.getUint32(0), tables }
}

/** An sfnt file from its tables: a directory in tag order, each table on a 4-byte boundary, checksums recomputed. */
function writeTables(version: number, tables: readonly Table[]): Uint8Array {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const count = sorted.length
  let entrySelector = 0
  while (2 ** (entrySelector + 1) <= count) entrySelector++
  const searchRange = 2 ** entrySelector * 16
  const padded = (length: number): number => (length + 3) & ~3
  const dataAt = 12 + count * 16
  const out = new Uint8Array(sorted.reduce((end, table) => end + padded(table.bytes.length), dataAt))
  const data = view(out)
  data.setUint32(0, version)
  data.setUint16(4, count)
  data.setUint16(6, searchRange)
  data.setUint16(8, entrySelector)
  data.setUint16(10, count * 16 - searchRange)
  let offset = dataAt
  let headAt = -1
  sorted.forEach((table, index) => {
    const at = 12 + index * 16
    for (let letter = 0; letter < 4; letter++) out[at + letter] = table.tag.charCodeAt(letter)
    out.set(table.bytes, offset)
    // `head` is summed with its own adjustment field zeroed.
    if (table.tag === 'head') {
      headAt = offset
      out.fill(0, offset + 8, offset + 12)
    }
    data.setUint32(at + 4, checksum(out.subarray(offset, offset + padded(table.bytes.length))))
    data.setUint32(at + 8, offset)
    data.setUint32(at + 12, table.bytes.length)
    offset += padded(table.bytes.length)
  })
  if (headAt >= 0) data.setUint32(headAt + 8, (0xb1b0afba - checksum(out)) >>> 0)
  return out
}

/**
 * The font with its family renamed to `family`. The family, full name and typographic family become `family`, the
 * PostScript name is `family` with its spaces made hyphens, and the unique id is derived from it. Every other record
 * that mentions `reservedName` (without regard to case) is dropped, except the copyright and licence records, which are
 * kept. A font with no `name` table is returned as it is.
 */
export function renameFamily(font: Uint8Array, family: string, reservedName: string): Uint8Array {
  const { version, tables } = readTables(font)
  const name = tables.find((table) => table.tag === 'name')
  if (name === undefined) return font
  const reserved = reservedName.toLowerCase().replace(/[\s-]+/g, '')
  const mentions = (record: NameRecord): boolean =>
    decode(record)
      .toLowerCase()
      .replace(/[\s-]+/g, '')
      .includes(reserved)
  const replaced = new Set([FAMILY, FULL_NAME, POSTSCRIPT, UNIQUE, TYPOGRAPHIC_FAMILY])
  const kept = readRecords(name.bytes).filter(
    (record) => KEPT.has(record.id) || (!replaced.has(record.id) && !mentions(record)),
  )
  const postscript = family.replace(/\s+/g, '-')
  const renamed = [
    windowsEnglish(FAMILY, family),
    windowsEnglish(UNIQUE, `${postscript};subset`),
    windowsEnglish(FULL_NAME, family),
    windowsEnglish(POSTSCRIPT, postscript),
    windowsEnglish(TYPOGRAPHIC_FAMILY, family),
  ]
  const rewritten = writeRecords([...kept, ...renamed])
  return writeTables(
    version,
    tables.map((table) => (table.tag === 'name' ? { tag: 'name', bytes: rewritten } : table)),
  )
}
