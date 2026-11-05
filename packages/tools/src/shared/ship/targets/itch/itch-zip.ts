import { closeSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

// A small ZIP writer whose output depends only on the files' paths and bytes (the same build gives
// the same zip). It is used instead of yazl, which ship already carries for Ruken's CLI, because yazl has no
// types and writes its DOS timestamp in the machine's local time zone, so a fixed date still differs by zone.
//
// What makes it deterministic:
// - entries are sorted by path (code-unit order, not locale) whatever order they are given in;
// - every entry is dated 1980-01-01 00:00, the DOS epoch, with no extended-timestamp field;
// - every entry has unix mode 0644 and the UTF-8 name flag;
// - an entry is deflated (node:zlib, level 9) only when that is smaller, else stored. zlib's output is fixed for
//   a given zlib build, so two builds on the same Node give the same bytes.
// No ZIP64: itch.io's limits (1,000 files, 500 MB) are far below ZIP's 65,535 entries and 4 GiB.

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const VERSION_NEEDED = 20 // 2.0: deflate
const VERSION_MADE_BY = (3 << 8) | VERSION_NEEDED // 3: unix, so the external attributes hold a mode
const UTF8_NAMES = 1 << 11
const STORED = 0
const DEFLATED = 8
const DOS_TIME = 0 // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01
const FILE_MODE = 0o100644 // a regular file, rw-r--r--

interface CentralRecord {
  readonly name: Buffer
  readonly method: number
  readonly crc: number
  readonly compressedSize: number
  readonly size: number
  readonly offset: number
}

function localHeader(record: Omit<CentralRecord, 'offset'>): Buffer {
  const header = Buffer.alloc(30)
  header.writeUInt32LE(LOCAL_HEADER, 0)
  header.writeUInt16LE(VERSION_NEEDED, 4)
  header.writeUInt16LE(UTF8_NAMES, 6)
  header.writeUInt16LE(record.method, 8)
  header.writeUInt16LE(DOS_TIME, 10)
  header.writeUInt16LE(DOS_DATE, 12)
  header.writeUInt32LE(record.crc, 14)
  header.writeUInt32LE(record.compressedSize, 18)
  header.writeUInt32LE(record.size, 22)
  header.writeUInt16LE(record.name.length, 26)
  header.writeUInt16LE(0, 28) // no extra field
  return Buffer.concat([header, record.name])
}

function centralHeader(record: CentralRecord): Buffer {
  const header = Buffer.alloc(46)
  header.writeUInt32LE(CENTRAL_HEADER, 0)
  header.writeUInt16LE(VERSION_MADE_BY, 4)
  header.writeUInt16LE(VERSION_NEEDED, 6)
  header.writeUInt16LE(UTF8_NAMES, 8)
  header.writeUInt16LE(record.method, 10)
  header.writeUInt16LE(DOS_TIME, 12)
  header.writeUInt16LE(DOS_DATE, 14)
  header.writeUInt32LE(record.crc, 16)
  header.writeUInt32LE(record.compressedSize, 20)
  header.writeUInt32LE(record.size, 24)
  header.writeUInt16LE(record.name.length, 28)
  // extra field, comment, disk number and internal attributes: all 0 (bytes 30 to 37)
  header.writeUInt32LE((FILE_MODE << 16) >>> 0, 38)
  header.writeUInt32LE(record.offset, 42)
  return Buffer.concat([header, record.name])
}

function endOfCentralDirectory(count: number, size: number, offset: number): Buffer {
  const record = Buffer.alloc(22)
  record.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0)
  record.writeUInt16LE(count, 8)
  record.writeUInt16LE(count, 10)
  record.writeUInt32LE(size, 12)
  record.writeUInt32LE(offset, 16)
  return record
}

/**
 * Writes `files` (paths relative to `distDir`, `/`-separated) to a ZIP at `outPath`. The archive is written
 * beside it first and renamed into place, so a failed write never leaves a half zip under the final name.
 */
export function writeDeterministicZip(outPath: string, distDir: string, files: readonly string[]): void {
  const sorted = [...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const partial = `${outPath}.partial`
  const fd = openSync(partial, 'w')
  try {
    let offset = 0
    const write = (bytes: Buffer): void => {
      writeSync(fd, bytes)
      offset += bytes.length
    }
    const records: CentralRecord[] = []
    for (const file of sorted) {
      const bytes = readFileSync(join(distDir, file))
      const deflated = deflateRawSync(bytes, { level: 9 })
      const useDeflate = deflated.length < bytes.length
      const record = {
        name: Buffer.from(file, 'utf8'),
        method: useDeflate ? DEFLATED : STORED,
        crc: crc32(bytes),
        compressedSize: useDeflate ? deflated.length : bytes.length,
        size: bytes.length,
        offset,
      }
      records.push(record)
      write(localHeader(record))
      write(useDeflate ? deflated : bytes)
    }
    const centralStart = offset
    for (const record of records) write(centralHeader(record))
    write(endOfCentralDirectory(records.length, offset - centralStart, centralStart))
  } finally {
    closeSync(fd)
  }
  renameSync(partial, outPath)
}
