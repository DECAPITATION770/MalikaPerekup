import { cn } from '@/lib/utils';

function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...rest} />;
}

export { Skeleton };
