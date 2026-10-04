/**
 * Shared, mutable state between the page (scroll, pointer, chosen person) and the WebGL scene.
 * Written by DOM event handlers and read every frame by the scene — deliberately outside React,
 * so scrolling never triggers a re-render.
 */
export const sceneState = {
  /** Continuous story position: 0 archive, 1 index wall, 2 clearance, 3 answer, 4 vault. */
  stage: 0,
  /** 0 = Sam (support), 1 = Dana (finance): who the clearance is evaluated for. */
  persona: 0,
  /** Pointer in normalized device coordinates (-1..1), and whether it is over the page. */
  pointer: { x: 0, y: 0, active: false },
  /** Darkness of the page background, 0 paper → 1 vault ink. */
  dark: 0,
  reducedMotion: false,
  compact: false,
  /** Requests a frame when the scene only renders on demand (software WebGL). */
  invalidate: null as null | (() => void),
};

export type SceneState = typeof sceneState;
