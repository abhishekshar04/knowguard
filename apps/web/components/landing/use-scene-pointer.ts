'use client';

import { type RefObject, useEffect } from 'react';

import { sceneState } from './scene-state';

/** Feeds the mouse position, measured within the scene's region, to the scene (mouse only). */
export function useScenePointer(region: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const element = region.current;
      if (event.pointerType !== 'mouse' || !element) return;
      const rect = element.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      sceneState.pointer.active = inside;
      if (!inside) return;
      sceneState.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      sceneState.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      sceneState.invalidate?.();
    };
    const leave = () => {
      sceneState.pointer.active = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [region]);
}
