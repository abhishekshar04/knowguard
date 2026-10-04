import {
  BookOpenCheck,
  Building2,
  ChevronDown,
  Cpu,
  FileSearch,
  Fingerprint,
  KeyRound,
  Lock,
  Layers,
  type LucideIcon,
  MessageSquareQuote,
  ScrollText,
  Search,
  ShieldCheck,
  ShieldHalf,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { AnswerPanel, PersonaSwitch } from './clearance-demo';
import { CONTAINER, STORY_COLUMN } from './layout-tokens';

/*
 * The landing page's content, in plain HTML. The story chapters ([data-stage]) advance the 3D
 * archive, which lives in its own region (right half on wide screens, a top band on small ones);
 * story text stays in the left column so the two never overlap. The scene fades out at
 * [data-scene-end], before the full-width sections.
 */

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal';
const primaryButton = cn(
  'bg-ink hover:bg-ink/85 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full px-6 text-[15px] font-semibold text-white transition-colors duration-200',
  focus,
);
const secondaryButton = cn(
  'border-rule text-ink hover:border-ink/30 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border bg-white px-6 text-[15px] font-semibold transition-colors duration-200',
  focus,
);

const h2 =
  'font-display text-ink text-[clamp(1.9rem,min(3.4vw,5.6vh),3.25rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance';
const lead = 'text-ink-soft text-[17px] leading-[1.65] sm:text-lg [@media(max-height:820px)]:text-base';

// ── Hero ───────────────────────────────────────────────────────────────────────────────

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative pt-[calc(4.5rem+38dvh+1.5rem)] pb-20 lg:flex lg:min-h-dvh lg:items-center lg:pt-[4.5rem] lg:pb-0"
    >
      <div className={CONTAINER}>
        <div className={STORY_COLUMN}>
          <h1
            id="hero-title"
            className="font-display text-ink text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.98] font-extrabold tracking-[-0.045em]"
          >
            <span className="kg-line">
              <span>Knowledge, on a</span>
            </span>{' '}
            {/* The space keeps the words apart for screen readers and text selection. */}
            <span className="kg-line">
              <span>need-to-know basis.</span>
            </span>
          </h1>
          <p className={cn('kg-rise mt-7', lead)}>
            KnowGuard answers your team’s questions from your company’s own documents, with sources for every
            claim, and only ever reads the ones each person is cleared to see.
          </p>
          <div className="kg-rise mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={signedIn ? '/dashboard' : '/register'} className={primaryButton}>
              {signedIn ? 'Open KnowGuard' : 'Create a workspace'}
            </Link>
            <a href="#clearance" className={secondaryButton}>
              See how clearance works
            </a>
          </div>
          <ul className="kg-rise text-ink-soft mt-10 grid gap-2.5 text-sm">
            {[
              'Citations on every answer',
              'Tenant-isolated by design',
              'Search runs on your own servers',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <ShieldCheck className="text-signal size-4 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="kg-rise text-ink-soft mt-10 hidden text-sm lg:block">
            The card catalogue on the right is live: move your cursor through the drawers.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Story chapters ─────────────────────────────────────────────────────────────────────

function Chapter({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-stage
      aria-labelledby={`${id}-title`}
      className="relative min-h-[115vh] scroll-mt-[4.5rem] lg:min-h-[165vh]"
    >
      {/* Pinned beside the scene on wide screens; on short or small screens it simply scrolls. */}
      <div className="py-12 lg:sticky lg:top-[4.5rem] lg:flex lg:min-h-[calc(100dvh-4.5rem)] lg:items-center lg:py-8 [@media(max-height:640px)]:static [@media(max-height:640px)]:min-h-0">
        <div className={CONTAINER}>
          <div className={STORY_COLUMN}>
            <p
              aria-hidden
              className="border-ink text-ink-soft mb-7 border-t pt-3 [@media(max-height:820px)]:mb-4 font-mono text-xs tabular-nums"
            >
              0{index} / 04
            </p>
            <h2 id={`${id}-title`} className={h2}>
              {title}
            </h2>
            <div className="mt-6 space-y-6 [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:space-y-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const VAULT: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Building2,
    title: 'Tenant isolation in the schema',
    text: 'Every record is bound to its organization in the database itself.',
  },
  {
    icon: KeyRound,
    title: 'Sessions done right',
    text: 'HttpOnly cookies, hashed tokens, idle and absolute expiry, lockout.',
  },
  {
    icon: ShieldCheck,
    title: 'Strict browser policy',
    text: 'No third-party scripts, no inline code, no framing.',
  },
  {
    icon: ScrollText,
    title: 'Evidence on record',
    text: 'Views, sharing changes and every refused attempt, logged append-only.',
  },
];

export function Chapters() {
  return (
    <>
      <Chapter id="archive" index={1} title="Everything your company has written down.">
        <p className={lead}>
          Policies, contracts, runbooks, board papers. Upload them once and KnowGuard reads and indexes them
          on your own servers. Your documents are never sent elsewhere to be searched.
        </p>
      </Chapter>

      <Chapter id="clearance" index={2} title="Then everything you aren’t cleared for disappears.">
        <p className={lead}>
          Before a single search runs, KnowGuard checks who is asking: document visibility, teams,
          departments, roles and explicit denials. Documents that fail are never searched, ranked or shown to
          the AI.
        </p>
        <ul aria-label="What the scan shows" className="text-ink grid gap-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="bg-signal flex size-7 items-center justify-center rounded-md text-white">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            Readable: the card turns blue, with a check
          </li>
          <li className="flex items-center gap-3">
            <span className="border-locked/50 flex size-7 items-center justify-center rounded-md border border-dashed bg-white">
              <Lock className="text-locked size-4" aria-hidden />
            </span>
            No access: only an outline and a lock remain
          </li>
        </ul>
        <div>
          <p className="text-ink mb-3 text-sm font-medium">Switch whose badge is scanned:</p>
          <PersonaSwitch />
        </div>
      </Chapter>

      <Chapter id="answer" index={3} title="What’s left becomes an answer you can check.">
        <p className={lead}>
          Only readable documents flow into the AI model. The passages it uses come back numbered, as the
          sources of the answer.
        </p>
        <AnswerPanel />
      </Chapter>

      <Chapter id="security" index={4} title="Built like a vault, tested like one.">
        <p className={lead}>
          Four guarantees, locked together like the rings of a combination dial. They hold in the database and
          the code, and automated tests prove them on every change.
        </p>
        <ul className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
          {VAULT.map((item) => (
            <li key={item.title}>
              <item.icon className="text-signal size-5" aria-hidden />
              <h3 className="text-ink mt-3 font-semibold">{item.title}</h3>
              <p className="text-ink-soft mt-1 text-sm leading-relaxed">{item.text}</p>
            </li>
          ))}
        </ul>
      </Chapter>
    </>
  );
}

// ── After the story: full-width sections ──────────────────────────────────────────────

const FACTS: Array<[string, string]> = [
  ['100%', 'of API routes tested for cross-tenant leaks on every commit'],
  ['4', 'retrieval stages, every one behind the permission filter'],
  ['0', 'unreadable passages placed in an AI prompt, by design and tested'],
  ['11', 'prompt-injection tricks in the regression suite'],
];

const STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Fingerprint, title: 'Authorize', text: 'Find the documents this person may read.' },
  { icon: FileSearch, title: 'Retrieve', text: 'Keyword and meaning search, only inside that set.' },
  { icon: Layers, title: 'Rerank', text: 'A local model picks the best passages.' },
  { icon: ShieldHalf, title: 'Ground', text: 'Document text is sealed off from instructions.' },
  { icon: BookOpenCheck, title: 'Cite', text: 'The answer streams back with its sources.' },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string; wide?: boolean }> = [
  {
    icon: MessageSquareQuote,
    title: 'Ask AI, with receipts',
    text: 'Streamed answers in plain language. Every statement links to its source: click a citation and land on the document.',
    wide: true,
  },
  {
    icon: Search,
    title: 'Hybrid search',
    text: 'Exact terms and error codes, plus meaning-based matches, fused and reranked.',
  },
  {
    icon: Layers,
    title: 'Fine-grained sharing',
    text: 'Private, specific people, teams, departments, roles or everyone, with explicit denials that always win.',
  },
  {
    icon: Cpu,
    title: 'Your text stays home',
    text: 'Search and indexing run on your own servers. Only passages a person may read reach the answer model.',
    wide: true,
  },
  {
    icon: ScrollText,
    title: 'Tamper-proof audit log',
    text: 'Views, downloads, sharing changes and every denied attempt, append-only and enforced by the database.',
    wide: true,
  },
  {
    icon: Users,
    title: 'Admin without overreach',
    text: 'Admins manage people and roles, yet can’t read private documents or grant access they don’t hold.',
  },
];

const QUESTIONS: Array<[string, string]> = [
  [
    'Can the AI reveal a document someone isn’t allowed to read?',
    'No. Access is checked before retrieval, so a document a person can’t read is never searched, ranked or placed in the AI’s prompt. It can’t reveal what it never receives.',
  ],
  [
    'Which AI models does it work with?',
    'OpenAI, Google Gemini, Azure OpenAI or a model you host yourself. Search and indexing run on your servers either way.',
  ],
  [
    'Can administrators read everyone’s private documents?',
    'No. Administrators manage people, roles and teams, but document access follows the same rules for everyone. Even the audit log hides the titles of documents the reviewer can’t open.',
  ],
  [
    'What happens when someone loses access?',
    'It applies on their next request, and earlier answers based on that document are hidden from them too.',
  ],
  [
    'Which files can I upload?',
    'PDF, Word (.docx), Markdown and plain text. Every upload keeps its version history.',
  ],
];

function SectionHeading({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="mb-14 grid gap-6 lg:grid-cols-2 lg:items-end">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <p className={cn('max-w-xl lg:justify-self-end', lead)}>{text}</p>
    </div>
  );
}

export function AfterStory({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <section data-scene-end aria-label="Guarantees" className="pt-28 pb-12">
        <div className={CONTAINER}>
          <dl className="border-ink grid border-t sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map(([value, label], i) => (
              <div
                key={label}
                className={cn(
                  'border-rule py-8 sm:pr-8',
                  i > 0 && 'border-t sm:border-t-0',
                  i % 2 === 1 && 'sm:border-l sm:pl-8',
                  i === 2 && 'sm:border-t lg:border-t-0 lg:border-l lg:pl-8',
                  i === 3 && 'sm:border-t lg:border-t-0',
                )}
              >
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="font-display text-ink block text-[clamp(3rem,5vw,4.5rem)] leading-none font-bold tracking-[-0.04em]">
                    {value}
                  </span>
                  <span className="text-ink-soft mt-3 block max-w-[16rem] text-sm leading-relaxed">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="pipeline-title" className="py-24">
        <div className={CONTAINER}>
          <SectionHeading
            id="pipeline-title"
            title="Five steps, one rule"
            text="Authorization is the first step of every search and every answer, never an afterthought bolted onto the model."
          />
          <div className="relative">
            <svg
              aria-hidden
              className="absolute top-[1.375rem] left-0 hidden h-2 w-full lg:block"
              preserveAspectRatio="none"
              viewBox="0 0 100 2"
            >
              <line
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="var(--color-rule)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <line
                className="kg-beam"
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="var(--color-signal)"
                strokeWidth="1.5"
                strokeDasharray="6 14"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="border-rule text-ink relative flex size-11 items-center justify-center rounded-full border bg-white">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-ink mt-5 font-semibold">
                    <span className="text-ink-soft mr-2 font-mono text-xs tabular-nums">0{i + 1}</span>
                    {step.title}
                  </h3>
                  <p className="text-ink-soft mt-1.5 max-w-[15rem] text-sm leading-relaxed">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="features" aria-labelledby="features-title" className="scroll-mt-[4.5rem] py-24">
        <div className={CONTAINER}>
          <SectionHeading
            id="features-title"
            title="Built for teams who can’t afford a leak"
            text="Search, answers, sharing and oversight, designed together so security is the default rather than a setting."
          />
          <ul className="bg-rule border-rule grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className={cn('bg-white p-8', feature.wide && 'md:col-span-2')}>
                <feature.icon className="text-signal size-6" aria-hidden />
                <h3 className="font-display text-ink mt-10 text-xl font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-ink-soft mt-2 max-w-md text-sm leading-relaxed">{feature.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-[4.5rem] py-24">
        <div className={cn(CONTAINER, 'grid gap-12 lg:grid-cols-[1fr_1.6fr]')}>
          <h2 id="faq-title" className={h2}>
            Questions, answered
          </h2>
          <div className="border-ink border-t">
            {QUESTIONS.map(([question, answer]) => (
              <details key={question} className="group border-rule border-b">
                <summary className="text-ink focus-visible:outline-signal flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-medium focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDown
                    className="text-ink-soft size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="text-ink-soft max-w-2xl pb-6 leading-relaxed">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="start-title" className="pt-12 pb-24">
        <div className={CONTAINER}>
          <div className="bg-ink relative overflow-hidden rounded-3xl px-6 py-20 sm:px-14">
            <h2
              id="start-title"
              className="font-display max-w-3xl text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.98] font-bold tracking-[-0.04em] text-balance text-white"
            >
              Give your team answers they can trust.
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.7] text-white/65 sm:text-lg">
              Set up a workspace in a minute. Invite your team, upload documents and ask your first question.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signedIn ? '/dashboard' : '/register'}
                className={cn(
                  'text-ink inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-white px-6 text-[15px] font-semibold transition-colors duration-200 hover:bg-white/85',
                  focus,
                )}
              >
                {signedIn ? 'Open KnowGuard' : 'Create a workspace'}
              </Link>
              {signedIn ? null : (
                <Link
                  href="/login"
                  className={cn(
                    'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-white/20 px-6 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-white/10',
                    focus,
                  )}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-rule border-t py-10">
        <div
          className={cn(CONTAINER, 'text-ink-soft flex flex-col justify-between gap-3 text-sm sm:flex-row')}
        >
          <p>© {new Date().getFullYear()} KnowGuard. Permission-aware enterprise knowledge.</p>
          <nav aria-label="Footer" className="flex gap-6">
            <a href="#security" className="hover:text-ink">
              Security
            </a>
            <a href="#faq" className="hover:text-ink">
              FAQ
            </a>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
