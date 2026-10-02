import type { AnalyticsDay } from '@knowguard/types';

const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * One metric over time as thin bars (a single series: one hue, no legend; the title names it).
 * Each bar has its own scale-independent tooltip on hover and keyboard focus. Bars anchor to the
 * baseline with a rounded top and a 2px gap.
 */
export function ActivityChart({
  title,
  days,
  metric,
}: {
  title: string;
  days: AnalyticsDay[];
  metric: keyof Omit<AnalyticsDay, 'date'>;
}) {
  const values = days.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const first = days[0];
  const last = days.at(-1);

  return (
    <figure className="flex flex-col gap-2" data-testid={`chart-${metric}`}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{total.toLocaleString()} total</span>
      </figcaption>
      <div className="relative">
        {/* Recessive gridline at the maximum, labeled once. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-card pl-1 text-[0.65rem] tabular-nums text-muted-foreground">
          {max}
        </span>
        <ol
          className="flex h-24 items-end gap-[2px] border-b border-border pt-2"
          aria-label={`${title} per day`}
        >
          {days.map((day) => {
            const value = day[metric];
            const height = value === 0 ? 0 : Math.max(4, (value / max) * 100);
            return (
              <li key={day.date} className="group relative flex h-full flex-1 items-end">
                <span
                  tabIndex={0}
                  aria-label={`${formatDay(day.date)}: ${value} ${title.toLowerCase()}`}
                  className="block w-full rounded-t-[4px] bg-primary/80 outline-none transition-colors group-hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ height: `${height}%`, minHeight: value === 0 ? 0 : 2 }}
                />
                {/* Hit target taller than the mark, so small bars are easy to hover. */}
                <span className="absolute inset-0" aria-hidden />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs text-card-foreground shadow-sm group-focus-within:block group-hover:block"
                >
                  <span className="text-muted-foreground">{formatDay(day.date)}</span>{' '}
                  <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {first && last ? (
        <div className="flex justify-between text-[0.65rem] text-muted-foreground">
          <span>{formatDay(first.date)}</span>
          <span>{formatDay(last.date)}</span>
        </div>
      ) : null}
    </figure>
  );
}
