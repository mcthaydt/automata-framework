// A promise the Ask controller's tests settle themselves: the proposal still on its way. The scripted provider is the
// kit's (`createScriptedAsk` in `@mcthaydt/automata-editor-kit/ports/testing`), so the port has one fake.

/** A promise the test settles when it chooses: the proposal that is still on its way. */
export function deferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
