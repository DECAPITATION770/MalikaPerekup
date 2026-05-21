interface Props {
  w?: string | number;
  h?: string | number;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const ROUND = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  '2xl': 'rounded-3xl',
  full: 'rounded-full',
} as const;

export default function Skeleton({ w = '100%', h = 16, className = '', rounded = 'lg' }: Props) {
  return (
    <div
      className={`skeleton ${ROUND[rounded]} ${className}`}
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
      }}
      aria-hidden="true"
    />
  );
}
