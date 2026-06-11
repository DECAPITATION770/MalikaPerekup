/**
 * Skeleton primitives used during loading states.
 *
 * - `Skeleton`     : bare animated div, use for one-off placeholders
 * - `CardSkeleton` : card-shaped block (KPI tiles, stat cards)
 * - `TableRowSkeleton` : row inside a list/table-like layout
 *
 * Animation lives in index.css `.sk` utility.
 */
import { cn } from '@/lib/utils';

function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('sk rounded-md', className)} {...rest} />;
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-border bg-bg2 p-5', className)}>
      <div className="sk mb-3 h-3 w-24 rounded" />
      <div className="sk h-8 w-32 rounded" />
    </div>
  );
}

function TableRowSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="sk h-9 w-9 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="sk h-3 w-1/3 rounded" />
        <div className="sk h-2.5 w-1/4 rounded" />
      </div>
      {Array.from({ length: Math.max(0, cols - 2) }).map((_, i) => (
        <div key={i} className="sk h-3 w-16 shrink-0 rounded" />
      ))}
    </div>
  );
}

export { Skeleton, CardSkeleton, TableRowSkeleton };
export default Skeleton;
