// What makes two painted cells the same cell: the pose, the view (one of eight directions, the camera's pitch to the
// painter's 2 degrees), the density, what the figure wears and holds, and the face. The cache and the paint queue are
// keyed on it.

export interface CellKeyParts {
  /** The pose's name: a stepped idle, a walk pose, a made pose. */
  readonly pose: string
  /** The figure's yaw against the camera, in 45 degree steps (0 to 7). */
  readonly direction: number
  /** The camera's pitch (rad), already snapped. */
  readonly pitch: number
  readonly density: number
  readonly outfit: string
  readonly item: string | null
  /** The face's tags and blink, as one string. */
  readonly face: string
}

export function cellKey(parts: CellKeyParts): string {
  return [
    parts.pose,
    parts.direction,
    parts.pitch.toFixed(4),
    parts.density,
    parts.outfit,
    parts.item ?? '-',
    parts.face,
  ].join('|')
}
