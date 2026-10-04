import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Frontend security guardrails (ADR 0013). If one of these blocks something you need, talk it
 * through in review rather than disabling it inline.
 */
const securityRules = {
  // Raw HTML is the classic XSS hole. Render text; for rich content, add a reviewed sanitizer.
  'react/no-danger': 'error',
  'react/jsx-no-script-url': 'error',
  'react/jsx-no-target-blank': ['error', { allowReferrer: false, enforceDynamicLinks: 'always' }],
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-restricted-properties': [
    'error',
    { object: 'document', property: 'write', message: 'Never write raw HTML into the document.' },
    {
      object: 'document',
      property: 'cookie',
      message: 'Session cookies are HttpOnly; never read or write cookies in the browser.',
    },
    {
      object: 'window',
      property: 'localStorage',
      message:
        'Do not store data in localStorage: it outlives the session and is readable by any script. Keep state on the server.',
    },
    {
      object: 'window',
      property: 'sessionStorage',
      message: 'Do not store data in sessionStorage: keep state on the server.',
    },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'localStorage', message: 'Do not store data in localStorage (see no-restricted-properties).' },
    {
      name: 'sessionStorage',
      message: 'Do not store data in sessionStorage (see no-restricted-properties).',
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
      message: 'Do not assign HTML strings to the DOM; render React elements instead.',
    },
    {
      selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
      message: 'Do not insert HTML strings into the DOM; render React elements instead.',
    },
    {
      selector:
        "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_/]",
      message: 'NEXT_PUBLIC_ variables are shipped to every browser. Keep configuration server-side.',
    },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/lib/api', '**/lib/session', '@/lib/api', '@/lib/session'],
          importNames: ['apiRequest', 'apiUpload', 'apiFetchRaw', 'apiStream', 'getSessionToken'],
          message:
            'Only server code (server components, server actions, route handlers) may call the API or read the session.',
        },
      ],
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      ...securityRules,
    },
  },
  {
    // Server-only code is allowed to talk to the API (the 'server-only' import enforces it at build).
    files: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/actions.ts', 'app/**/route.ts', 'lib/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Browser tests inspect cookies and storage on purpose (e.g. to prove the session is HttpOnly).
    files: ['e2e/**'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-globals': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
]);
