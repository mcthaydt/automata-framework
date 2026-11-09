// A half-second sound file (8-bit mono WAV), so a journey has music to drop into the game's folder. The pitch is taken from
// the name, so two tracks differ. It is a file a person would bring, not music the editors make.

/** A WAV file's bytes: 4000 samples at 8 kHz of a sine as high as `name` is long (`calm.wav` and `chase.wav` differ). */
export function tone(name: string): Buffer {
  const samples = 4000
  const rate = 8000
  const pitch = 200 + name.length * 40
  const data = Buffer.alloc(samples)
  for (let i = 0; i < samples; i += 1)
    data[i] = Math.round(128 + 60 * Math.sin((2 * Math.PI * pitch * i) / rate))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + samples, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate, 28)
  header.writeUInt16LE(1, 32)
  header.writeUInt16LE(8, 34)
  header.write('data', 36)
  header.writeUInt32LE(samples, 40)
  return Buffer.concat([header, data])
}
