interface Props {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ className = '', rounded = 'md' }: Props) {
  const r = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', xl: 'rounded-2xl', full: 'rounded-full' }[rounded];
  return <div className={`sk ${r} ${className}`} />;
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
      <Skeleton className="w-9 h-9" rounded="lg" />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'flex-1' : 'w-20'}`} rounded="sm" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-bg3 rounded-2xl border border-border p-5">
      <Skeleton className="h-3 w-20 mb-3" rounded="sm" />
      <Skeleton className="h-8 w-32" rounded="sm" />
    </div>
  );
}
