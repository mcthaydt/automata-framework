/**
 * What a CameraDragSurface drives (M4 spec §16.3.7): runtime's `CameraDragTracker` satisfies it, so ui need not
 * import runtime. `down` answers whether the pointer now drives the drag (a finger's primary contact, the mouse's
 * secondary button, none already dragging).
 */
export interface DragTracker {
  down(id: number, x: number, start: { readonly pointerType: string; readonly button: number }): boolean
  move(id: number, x: number): void
  up(id: number): void
  cancel(): void
}

/** CameraDragSurface's props. */
export interface CameraDragSurfaceProps {
  tracker: DragTracker
  testId?: string | undefined
}
