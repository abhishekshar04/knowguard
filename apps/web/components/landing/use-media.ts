'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Live prefers-reduced-motion (reacts to OS changes mid-session). False during server render. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export type WebGLTier = 'hardware' | 'software' | 'none';

let tier: WebGLTier | undefined;
function detectWebGL(): WebGLTier {
  if (tier === undefined) {
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) {
        tier = 'none';
      } else {
        // CPU renderers (no GPU, or GPU blocked) can't afford a continuously animated scene.
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = String(
          info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        );
        tier = /swiftshader|llvmpipe|software|basic render/i.test(renderer) ? 'software' : 'hardware';
        gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe context now
      }
    } catch {
      tier = 'none';
    }
  }
  return tier;
}

const noSubscription = () => () => {};

/** What this browser's WebGL can afford; null during server render. */
export function useWebGLTier(): WebGLTier | null {
  return useSyncExternalStore(noSubscription, detectWebGL, () => null);
}
