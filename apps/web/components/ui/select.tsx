import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** Native select styled to match Input: accessible and works without JavaScript. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'kg-select h-10 cursor-pointer rounded-lg border border-input bg-card pr-9 pl-3 text-sm shadow-xs outline-none pointer-coarse:h-11',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
