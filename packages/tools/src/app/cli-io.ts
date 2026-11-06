/** Where a command writes: its output and its errors. Tests pass their own; the bin passes the process's. */
export interface CliIo {
  readonly stdout: (msg: string) => void
  readonly stderr: (msg: string) => void
}

export const PROCESS_IO: CliIo = {
  stdout: (msg) => process.stdout.write(msg),
  stderr: (msg) => process.stderr.write(msg),
}
