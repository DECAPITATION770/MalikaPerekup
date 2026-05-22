/**
 * Offline queue for installment payments.
 *
 * Market floor connectivity is flaky. When a payment POST fails because
 * the device is offline, we stash it in IndexedDB (idb-keyval) and replay
 * the whole queue when the connection returns. Each entry is keyed by a
 * client-generated id so a double-flush can't double-charge.
 */
import { get, set, del } from 'idb-keyval';

const QUEUE_KEY = 'malika-offline-payments-v1';

export interface QueuedPayment {
  id: string; // client uuid — dedupe key
  planId: number;
  amount: string; // Decimal-as-string
  queuedAt: number; // epoch ms
}

export async function readQueue(): Promise<QueuedPayment[]> {
  return (await get<QueuedPayment[]>(QUEUE_KEY)) ?? [];
}

export async function enqueuePayment(planId: number, amount: string): Promise<QueuedPayment> {
  const entry: QueuedPayment = {
    id: crypto.randomUUID(),
    planId,
    amount,
    queuedAt: Date.now(),
  };
  const queue = await readQueue();
  await set(QUEUE_KEY, [...queue, entry]);
  return entry;
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((e) => e.id !== id);
  if (next.length === 0) await del(QUEUE_KEY);
  else await set(QUEUE_KEY, next);
}

export async function queueSize(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Replay every queued payment via `submit`. Successful entries are removed;
 * failures stay queued for the next attempt. Returns count flushed.
 */
export async function flushQueue(
  submit: (planId: number, amount: string) => Promise<void>,
): Promise<number> {
  const queue = await readQueue();
  let flushed = 0;
  for (const entry of queue) {
    try {
      await submit(entry.planId, entry.amount);
      await removeFromQueue(entry.id);
      flushed += 1;
    } catch {
      // Leave in queue; stop on first failure to preserve ordering.
      break;
    }
  }
  return flushed;
}
