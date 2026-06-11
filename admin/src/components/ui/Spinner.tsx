import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Minimal spinner used in buttons and loading states. */
export default function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden />;
}
