'use client';

import Lenis from 'lenis';
import dynamic from 'next/dynamic';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { display } from './fonts';
import { SceneBoundary } from './scene-boundary';
import { sceneState } from './scene-state';
import { usePrefersReducedMotion, useWebGLTier } from './use-media';
import { useScenePointer } from './use-scene-pointer';

const ArchiveScene = dynamic(() => import('./archive-scene'), { ssr: false });

// ── The person the clearance is evaluated for, shared by the demo UI and the 3D scene ──────

export type PersonaId = 'sam' | 'dana';
const PersonaContext = createContext<{ persona: PersonaId; setPersona: (p: PersonaId) => void } | null>(null);

export function usePersona() {
  const value = useContext(PersonaContext);
  if (!value) throw new Error('usePersona must be used inside <Experience>');
  return value;
}

/** Story position: each [data-stage] chapter completes as its top travels up the viewport. */
function readStage(): { stage: number; sceneOpacity: number } {
  const viewport = window.innerHeight;
  let stage = 0;
  document.querySelectorAll<HTMLElement>('[data-stage]').forEach((element) => {
    const top = element.getBoundingClientRect().top;
    stage += Math.min(1, Math.max(0, (viewport * 0.8 - top) / (viewport * 0.75)));
  });
  // The scene bows out before the content sections that follow the story.
  const end = document.querySelector<HTMLElement>('[data-scene-end]');
  const endTop = end ? end.getBoundingClientRect().top : Infinity;
  const sceneOpacity = Math.min(1, Math.max(0, (endTop - viewport * 0.35) / (viewport * 0.45)));
  return { stage, sceneOpacity };
}

/**
 * The landing page's frame: smooth scrolling, the archive scene in its own region of the screen
 * (right column on wide screens, a top band on small ones — never behind text), and the shared
 * persona. All content stays plain HTML.
 */
export function Experience({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [persona, setPersona] = useState<PersonaId>('sam');
  const reducedMotion = usePrefersReducedMotion();
  const tier = useWebGLTier();
  const [compact, setCompact] = useState<boolean | null>(null);
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      sceneState.compact = query.matches;
      setCompact(query.matches);
    };
    const initial = window.setTimeout(update, 0);
    query.addEventListener('change', update);
    return () => {
      window.clearTimeout(initial);
      query.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    sceneState.persona = persona === 'sam' ? 0 : 1;
    sceneState.invalidate?.();
  }, [persona]);

  useEffect(() => {
    sceneState.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  // Smooth scrolling (not under reduced motion), scroll → story stage, and the scene's fade-out.
  useEffect(() => {
    const lenis = reducedMotion ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    let frame = 0;
    let lastStage = -1;
    const tick = (time: number) => {
      lenis?.raf(time);
      const { stage, sceneOpacity } = readStage();
      sceneState.stage = stage;
      if (stage !== lastStage) {
        lastStage = stage;
        sceneState.invalidate?.();
      }
      const element = region.current;
      if (element) {
        element.style.opacity = String(sceneOpacity);
        element.style.visibility = sceneOpacity < 0.01 ? 'hidden' : 'visible';
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // In-page links land where the reader should be: a story chapter at its resting point (its
    // scene fully formed), anything else just below the header.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (!target) return;
      event.preventDefault();
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const offset = target.hasAttribute('data-stage')
        ? wide
          ? 0 // pinned beside the scene: the chapter's top is its resting point
          : 72 + window.innerHeight * 0.38 // below the header and the scene band
        : 88;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      if (lenis) lenis.scrollTo(top, { duration: 1.2 });
      else window.scrollTo({ top });
      window.history.replaceState(null, '', `#${id}`);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [reducedMotion]);

  useScenePointer(region);

  const context = useMemo(() => ({ persona, setPersona }), [persona]);

  return (
    <PersonaContext.Provider value={context}>
      <div className="kg-experience bg-paper text-ink relative min-h-dvh">
        <div aria-hidden className="kg-grid pointer-events-none fixed inset-0" />
        <div
          ref={region}
          aria-hidden
          data-testid="archive-canvas"
          className="kg-scene-region pointer-events-none fixed z-20"
        >
          {tier && tier !== 'none' && compact !== null ? (
            <SceneBoundary>
              <ArchiveScene
                compact={compact}
                lowPower={tier === 'software'}
                font={display.style.fontFamily}
              />
            </SceneBoundary>
          ) : null}
        </div>
        {header}
        <div className="relative z-10">{children}</div>
      </div>
    </PersonaContext.Provider>
  );
}
