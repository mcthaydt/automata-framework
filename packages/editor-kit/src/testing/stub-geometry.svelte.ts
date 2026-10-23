import { type Geometry, type GeometryState, measureGeometry } from '@mcthaydt/automata-ui'

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

/** A geometry owner's state that a test can resize, measured the way the owner measures it. */
export interface ResizableGeometry extends GeometryState {
  resize(width: number, height: number): void
}

function measure(width: number, height: number): Geometry {
  return measureGeometry({ layout: { width, height }, envSafeArea: NO_INSETS })
}

class StubGeometry implements ResizableGeometry {
  current: Geometry

  constructor(width: number, height: number) {
    this.current = $state.raw(measure(width, height))
  }

  resize(width: number, height: number): void {
    this.current = measure(width, height)
  }
}

export function stubGeometry(width: number, height: number): ResizableGeometry {
  return new StubGeometry(width, height)
}
