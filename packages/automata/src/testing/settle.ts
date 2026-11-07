// Lets promise chains started by a test run to the end: each round waits one macrotask, which drains every microtask
// queued before it. A `fakeClock` moves timers; this moves the promises those timers resolve.

/** Waits `rounds` macrotasks (8 by default, enough for a fetch, a stream read and the callbacks after them). */
export async function settle(rounds = 8): Promise<void> {
  for (let round = 0; round < rounds; round++) await new Promise((resolve) => setTimeout(resolve, 0))
}
