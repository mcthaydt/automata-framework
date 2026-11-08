// The files in a zip, by name, as text: enough of the format to read what Publish hands over (stored or deflated
// entries, no zip64), with Node's own inflate, so a journey needs no zip package.
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50

export function readZip(path: string): Map<string, string> {
  const zip = readFileSync(path)
  let end = zip.length - 22
  while (end >= 0 && zip.readUInt32LE(end) !== END_OF_DIRECTORY) end--
  if (end < 0) throw new Error(`${path} is not a zip`)
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new Error(`${path}: a broken directory entry`)
    const method = zip.readUInt16LE(at + 10)
    const size = zip.readUInt32LE(at + 20)
    const nameLength = zip.readUInt16LE(at + 28)
    const extraLength = zip.readUInt16LE(at + 30)
    const commentLength = zip.readUInt16LE(at + 32)
    const local = zip.readUInt32LE(at + 42)
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength)
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const bytes = zip.subarray(start, start + size)
    files.set(name, (method === 0 ? bytes : inflateRawSync(bytes)).toString('utf8'))
    at += 46 + nameLength + extraLength + commentLength
  }
  return files
}
