// The frame clock the Walk view's eye moves on (ED3D.8b): `main.ts` hands the page's animation frames to the boot, which
// hands them down, because the views take time from the boot and read no clock of their own (the architecture test). The
// tests walk by hand with their own, and a page given none has an eye that does not move on its own.

export interface Frames {
  /** Calls `callback` with the time in seconds at the next frame; returns a handle for `cancel`. */
  request(callback: (seconds: number) => void): number
  cancel(handle: number): void
}

/** No frames: nothing moves by itself. */
export const NO_FRAMES: Frames = { request: () => 0, cancel: () => {} }
