'use client';

import { Lock } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { cn } from '@/lib/utils';

import { type PersonaId, usePersona } from './experience';
import { usePrefersReducedMotion } from './use-media';

/*
 * A scripted demonstration (clearly labelled) of the core rule: the same question, answered only
 * from what the selected person may read. The 3D archive follows the same switch.
 */

const PEOPLE: Record<
  PersonaId,
  { name: string; role: string; reads: string; answer: string; sources: string[]; hidden: string[] }
> = {
  sam: {
    name: 'Sam',
    role: 'Support',
    reads: 'Sam can read about half of the archive.',
    answer:
      'Enterprise customers can ask for a refund within 30 days of the invoice [1], and approved refunds are paid within 10 business days [2]. Nothing in the documents you can read mentions a review.',
    sources: ['Refund Policy, page 2', 'Enterprise Terms v4, section 9.3'],
    hidden: ['Refund Fraud Review', 'Board Minutes Q3'],
  },
  dana: {
    name: 'Dana',
    role: 'Finance',
    reads: 'Dana can read about three quarters, including finance reviews.',
    answer:
      'Enterprise customers can ask for a refund within 30 days of the invoice [1], paid within 10 business days [2]. Three refund requests from one reseller are under review until 14 November [3].',
    sources: ['Refund Policy, page 2', 'Enterprise Terms v4, section 9.3', 'Refund Fraud Review, page 1'],
    hidden: ['Board Minutes Q3'],
  },
};

const LONGEST_ANSWER = Object.values(PEOPLE).reduce(
  (longest, person) => (person.answer.length > longest.length ? person.answer : longest),
  '',
);

const QUESTION = 'What is our refund policy for enterprise contracts, and is anything under review?';

/**
 * Native radio buttons styled as a segmented control: arrow keys, a single tab stop and correct
 * announcements come from the browser. Every instance shares the same selection.
 */
export function PersonaSwitch({ className, caption = true }: { className?: string; caption?: boolean }) {
  const { persona, setPersona } = usePersona();
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className="sr-only">Ask as</legend>
      <div className="border-rule inline-flex rounded-full border bg-white p-1">
        {(Object.keys(PEOPLE) as PersonaId[]).map((id) => (
          <label
            key={id}
            className={cn(
              'relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm transition-colors duration-200',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal',
              persona === id ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={persona === id}
              onChange={() => setPersona(id)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <span>
              <span className="font-semibold">{PEOPLE[id].name}</span>, {PEOPLE[id].role.toLowerCase()}
            </span>
          </label>
        ))}
      </div>
      {caption ? (
        <p className="text-ink-soft mt-3 text-sm" aria-live="polite">
          {PEOPLE[persona].reads}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Streams the selected person's answer word by word (instantly under reduced motion). */
function useStreamedText(text: string, key: string, reduced: boolean): number {
  const [shown, setShown] = useState(0);
  const [current, setCurrent] = useState(key);
  if (current !== key) {
    setCurrent(key);
    setShown(0);
  }
  useEffect(() => {
    if (reduced) return;
    const words = text.split(/(?<=\s)/);
    const timers: number[] = [];
    let length = 0;
    words.forEach((word, i) => {
      length += word.length;
      const at = length;
      timers.push(window.setTimeout(() => setShown(at), 250 + i * 34));
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [text, key, reduced]);
  return reduced ? text.length : shown;
}

export function AnswerPanel() {
  const { persona } = usePersona();
  const reduced = usePrefersReducedMotion();
  const person = PEOPLE[persona];
  const shown = useStreamedText(person.answer, persona, reduced);
  const done = shown >= person.answer.length;

  return (
    <figure className="kg-sheet relative rounded-2xl p-5 sm:p-6" data-testid="answer-panel">
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <PersonaSwitch caption={false} />
        <span className="text-ink-soft text-xs">Simulated example</span>
      </div>
      <figcaption className="text-ink relative mt-4 text-sm leading-relaxed">
        <span className="text-ink-soft">{person.name} asks: </span>
        {QUESTION}
      </figcaption>

      {/* Screen readers hear the finished answer once, not every streamed word. */}
      <p className="sr-only" aria-live="polite">
        {done ? `Answer for ${person.name}: ${person.answer.replace(/\[(\d)\]/g, ' (source $1)')}` : ''}
      </p>
      <div className="border-rule bg-paper relative mt-4 rounded-xl border p-4" aria-busy={!done}>
        {/* The longest answer, invisible, reserves the space so nothing shifts while streaming. */}
        <div className="text-ink grid text-[15px] leading-relaxed [&>*]:col-start-1 [&>*]:row-start-1">
          <p aria-hidden className="invisible">
            {renderCitations(LONGEST_ANSWER)}
          </p>
          <p>
            {renderCitations(person.answer.slice(0, shown))}
            {!done ? (
              <span className="kg-caret bg-signal ml-0.5 inline-block h-4 w-px translate-y-0.5" />
            ) : null}
          </p>
        </div>
        <ol
          aria-label="Sources"
          className={cn(
            'border-rule mt-3 flex flex-wrap gap-1.5 border-t pt-3 text-[13px] transition-opacity duration-300',
            done ? 'opacity-100' : 'opacity-0',
          )}
        >
          {person.sources.map((source, i) => (
            <li
              key={source}
              className="text-ink border-rule inline-flex items-center gap-1.5 rounded-full border bg-white py-0.5 pr-2.5 pl-0.5"
            >
              <span className="bg-signal flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              {source}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-ink-soft relative mt-3 flex items-center gap-2 text-sm">
        <Lock className="text-locked size-4 shrink-0" aria-hidden />
        Never searched for {person.name}: {person.hidden.join(', ')}.
      </p>
    </figure>
  );
}

function renderCitations(text: string) {
  return text.split(/(\[\d\])/).map((part, i) =>
    /^\[\d\]$/.test(part) ? (
      <sup key={i} className="bg-signal-soft text-signal mx-0.5 rounded px-1 text-[0.7rem] font-semibold">
        {part.slice(1, -1)}
      </sup>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
