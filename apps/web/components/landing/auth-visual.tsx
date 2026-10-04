'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type AuthSceneMode, authState } from './auth-scene-state';
import { display } from './fonts';
import { SceneBoundary } from './scene-boundary';
import { sceneState } from './scene-state';
import { usePrefersReducedMotion, useWebGLTier } from './use-media';
import { useScenePointer } from './use-scene-pointer';

const AuthScene = dynamic(() => import('./auth-scenes'), { ssr: false });

const WIDE = '(min-width: 1024px)';
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const CAPTIONS: Record<AuthSceneMode, (organization: string) => [string, string]> = {
  vault: () => [
    'Your identity is checked before anything opens.',
    'Each detail you enter locks one ring of the dial. The door opens only onto what you’re cleared to read.',
  ],
  found: () => [
    'A private archive, and you hold the keys.',
    'Fill in the form and watch your workspace take shape. You become its owner.',
  ],
  join: (organization) => [
    `Your badge for ${organization}.`,
    'Choose a password to join its archive. You’ll see only what you’re cleared for.',
  ],
  refused: () => ['This invitation can’t open anything.', 'Ask your administrator for a new link.'],
};

/** Reads the form's state into the scene: whether fields are filled, never the password itself. */
function readForm(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('form input[name]').forEach(readField);
}
function readField(input: HTMLInputElement) {
  const value = input.value;
  switch (input.name) {
    case 'email':
      authState.email = value.includes('@');
      break;
    case 'password':
      authState.password = value.length >= (input.minLength > 0 ? input.minLength : 1);
      break;
    case 'name':
      authState.name = value.slice(0, 48);
      break;
    case 'organizationName':
      authState.organization = value.slice(0, 48);
      break;
  }
}

/**
 * The 3D picture beside the sign-in, sign-up and invitation forms (wide screens only), chosen by
 * page, with a caption saying what it shows.
 */
export function AuthVisual() {
  const pathname = usePathname();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  const tier = useWebGLTier();
  const reducedMotion = usePrefersReducedMotion();
  const region = useRef<HTMLDivElement>(null);
  const [organization, setOrganization] = useState('');

  const invite = pathname.startsWith('/invite');
  const mode: AuthSceneMode = invite
    ? organization
      ? 'join'
      : 'refused'
    : pathname.startsWith('/register')
      ? 'found'
      : 'vault';

  useEffect(() => {
    sceneState.reducedMotion = reducedMotion;
    sceneState.invalidate?.();
  }, [reducedMotion]);
  useScenePointer(region);

  // Follow the form on this page: typing, submitting, and an error coming back.
  useEffect(() => {
    Object.assign(authState, { email: false, password: false, name: '', organization: '', status: 'idle' });
    const found = document.querySelector<HTMLElement>('[data-organization]')?.dataset.organization ?? '';
    const initial = window.setTimeout(() => setOrganization(found), 0);
    readForm(document);
    let reset = 0;

    const onInput = (event: Event) => {
      if (event.target instanceof HTMLInputElement) readField(event.target);
      if (authState.status === 'denied') authState.status = 'idle';
      sceneState.invalidate?.();
    };
    const onSubmit = () => {
      authState.status = 'checking';
      sceneState.invalidate?.();
    };
    const observer = new MutationObserver(() => {
      readForm(document);
      const error = document.querySelector('[data-testid="form-error"], form [aria-invalid="true"]');
      if (error && authState.status === 'checking') {
        authState.status = 'denied';
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
          if (authState.status === 'denied') authState.status = 'idle';
          sceneState.invalidate?.();
        }, 2400);
      }
      sceneState.invalidate?.();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-invalid'],
    });
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(reset);
      observer.disconnect();
      document.removeEventListener('input', onInput);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [pathname]);

  const [title, text] = CAPTIONS[mode](organization);

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-10 p-10">
        <p className="font-display text-ink max-w-md text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance">
          {title}
        </p>
        <p className="text-ink-soft mt-2 max-w-md text-sm leading-relaxed">{text}</p>
      </div>
      <div ref={region} data-testid="auth-visual" className="absolute inset-x-0 top-40 bottom-0">
        {wide && tier && tier !== 'none' ? (
          <SceneBoundary>
            <AuthScene
              mode={mode}
              organization={organization}
              lowPower={tier === 'software'}
              font={display.style.fontFamily}
            />
          </SceneBoundary>
        ) : null}
      </div>
    </>
  );
}
