import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the amber dot over «и» (when used on tight UI surfaces). */
  bare?: boolean;
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
export function MalikaWordmark({ size = 'md', className, bare = false }: Props) {
  const { font, height } = SIZES[size];
  const width = parseInt(font) * 4.5; // approximate text width for the 6-glyph word
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Малика"
      className={cn('inline-block align-middle', className)}
    >
      <text
        x="0"
        y={height * 0.78}
        fontSize={font}
        fontWeight={800}
        letterSpacing="-0.02em"
        fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'
        fill="currentColor"
      >
        Малика
      </text>
      {!bare && (
        // Amber dot replaces the natural dot of «и» — positioned over the
        // 5th glyph (М-а-л-и-к-а → "и" is index 3).
        <circle
          cx={parseInt(font) * 2.05}
          cy={height * 0.27}
          r={parseInt(font) * 0.085}
          fill="rgb(var(--c-accent))"
        />
      )}
    </svg>
  );
}
