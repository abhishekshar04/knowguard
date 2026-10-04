import type { ReactNode } from 'react';

import { PUBLIC_FONTS } from '@/components/landing/fonts';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`${PUBLIC_FONTS} [color-scheme:light]`}>{children}</div>;
}
