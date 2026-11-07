/** 0 done · 1 an unexpected failure (git or a copy failed) · 2 refused or bad usage. */
export type CommandExit = 0 | 1 | 2

/** What a command printed and how it ended; the bins write it out and set the exit code. */
export interface CommandOutput {
  readonly exit: CommandExit
  readonly stdout: string
  readonly stderr: string
}
