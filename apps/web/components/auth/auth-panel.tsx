import type { ComponentProps, ReactNode } from 'react';

/** The heading and body of a sign-in page: plain type on white, no card. */
export function AuthPanel({
  title,
  description,
  children,
  ...props
}: { title: ReactNode; description: ReactNode; children: ReactNode } & Omit<
  ComponentProps<'section'>,
  'title'
>) {
  return (
    <section {...props}>
      <h1 className="font-display text-ink short:text-[2.1rem] shorter:text-[1.8rem] text-[2.5rem] leading-[1.02] font-bold tracking-[-0.035em]">
        {title}
      </h1>
      <p className="text-ink-soft short:mt-2 short:text-sm mt-3 text-[15px] leading-relaxed">{description}</p>
      <div className="short:mt-6 shorter:mt-4 mt-9">{children}</div>
    </section>
  );
}
