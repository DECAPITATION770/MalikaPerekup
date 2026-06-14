import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the amber dot over «и» (when used on tight UI surfaces). */
  bare?: boolean;
  /** Mark the SVG decorative when an ancestor element already labels it
   *  (e.g. a wrapping button with `aria-label`) — avoids screen readers
   *  announcing the brand name twice. */
  decorative?: boolean;
}

const SIZES = {
  sm: { font: '20', height: 24 },
  md: { font: '28', height: 32 },
  lg: { font: '36', height: 40 },
};

/**
 * «Малика» wordmark. Uses system display font with tightened tracking
 * plus an amber dot over the «и» — that single coloured dot is the brand
 * focal point on every screen (header, login, empty states).
 */
export function MalikaWordmark({
  size = 'md',
  className,
  bare = false,
  decorative = false,
}: Props) {
  const { font, height } = SIZES[size];
  const width = parseInt(font) * 4.7; // approximate text width for "perekup"
  const a11y = decorative
    ? { 'aria-hidden': true as const, focusable: false }
    : { role: 'img' as const, 'aria-label': 'perekup' };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      {...a11y}
      className={cn('inline-block align-middle', className)}
    >
      <text
        x="0"
        y={height * 0.78}
        fontSize={font}
        fontWeight={700}
        letterSpacing="-0.03em"
        // Geist Variable fronts the family list — the same display face used
        // for hero copy elsewhere, with weight pulled back from 800 to 700
        // because Geist is denser than SF Pro Display at the same numeric
        // weight. System fonts remain as the immediate fallback for the
        // first paint before the variable woff2 swaps in.
        fontFamily='"Geist Variable", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'
        fill="currentColor"
      >
        perekup
      </text>
      {!bare && (
        // Brass period after the wordmark — the brand's signature accent
        // (the ⇄ icon carries the colour elsewhere).
        <circle
          cx={parseInt(font) * 4.35}
          cy={height * 0.7}
          r={parseInt(font) * 0.085}
          fill="rgb(var(--c-accent))"
        />
      )}
    </svg>
  );
}
