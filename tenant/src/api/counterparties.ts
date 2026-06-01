import api from './client';
import type { Page } from './devices';

export type CounterpartyType = 'seller' | 'buyer' | 'both';

export interface CounterpartyOut {
  id: number;
  type: CounterpartyType;
  full_name: string;
  phone: string | null;
  doc_type: string | null;
  doc_number: string | null;
  doc_photos: string[];
  tg_username: string | null;
  comment: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type CounterpartyNoteKind =
  | 'call'
  | 'meeting'
  | 'message'
  | 'payment'
  | 'system'
  | 'other';

export interface CounterpartyNoteOut {
  id: number;
  counterparty_id: number;
  kind: CounterpartyNoteKind;
  body: string;
  created_at: string;
  created_by: number;
}

export interface CounterpartyStats {
  purchases_total_uzs: string;
  purchases_count: number;
  sales_total_uzs: string;
  sales_count: number;
  active_nasiya_count: number;
  /** Newest of (last purchase, last sale, last note). `null` for fresh
   *  counterparties we've never interacted with. */
  last_contact_at: string | null;
}

export interface CounterpartiesQuery {
  q?: string;
  type?: CounterpartyType;
  limit?: number;
  offset?: number;
}

/** List-only shape: same as {@link CounterpartyOut} plus per-row aggregates so
 *  the directory can show "owes ₽X across N deals" at a glance. Decimals come
 *  over the wire as strings (CLAUDE.md §9). */
export interface CounterpartyListItem extends CounterpartyOut {
  deals_count: number;
  outstanding_nasiya_uzs: string;
  last_deal_at: string | null;
}

export async function listCounterparties(
  query: CounterpartiesQuery = {},
): Promise<Page<CounterpartyListItem>> {
  const { data } = await api.get<Page<CounterpartyListItem>>('/counterparties', { params: query });
  return data;
}

export async function getCounterparty(id: number): Promise<CounterpartyOut> {
  const { data } = await api.get<CounterpartyOut>(`/counterparties/${id}`);
  return data;
}

export interface CounterpartyDocFile {
  url: string;
  name: string;
}

/** Short-lived signed GET URLs for a counterparty's documents (any file type). */
export async function getCounterpartyDocFiles(id: number): Promise<CounterpartyDocFile[]> {
  const { data } = await api.get<{ files: CounterpartyDocFile[] }>(
    `/counterparties/${id}/doc-urls`,
  );
  return data.files;
}

/** Sign a short-lived PUT URL for a counterparty document (passport, scan, PDF…). */
export async function requestCounterpartyUploadUrl(
  filename: string,
): Promise<{ url: string; key: string }> {
  const { data } = await api.post<{ url: string; key: string }>('/counterparties/upload-url', {
    filename,
  });
  return data;
}

export interface CounterpartyUpdate {
  type?: CounterpartyType;
  full_name?: string;
  phone?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  doc_photos?: string[];
  tg_username?: string | null;
  comment?: string | null;
}

export async function updateCounterparty(
  id: number,
  patch: CounterpartyUpdate,
): Promise<CounterpartyOut> {
  const { data } = await api.patch<CounterpartyOut>(`/counterparties/${id}`, patch);
  return data;
}

export interface CounterpartyDealsOut {
  counterparty: CounterpartyOut;
  // PurchaseOut and SaleOut imported by consumer page to avoid TS cycle.
  purchases: import('./purchases').PurchaseOut[];
  sales: import('./sales').SaleOut[];
}

export async function getCounterpartyDeals(id: number): Promise<CounterpartyDealsOut> {
  const { data } = await api.get<CounterpartyDealsOut>(`/counterparties/${id}/deals`);
  return data;
}

export async function getCounterpartyStats(id: number): Promise<CounterpartyStats> {
  const { data } = await api.get<CounterpartyStats>(`/counterparties/${id}/stats`);
  return data;
}

export async function listCounterpartyNotes(
  id: number,
): Promise<CounterpartyNoteOut[]> {
  const { data } = await api.get<CounterpartyNoteOut[]>(
    `/counterparties/${id}/notes`,
  );
  return data;
}

export async function createCounterpartyNote(
  id: number,
  body: string,
  kind: CounterpartyNoteKind = 'other',
): Promise<CounterpartyNoteOut> {
  const { data } = await api.post<CounterpartyNoteOut>(
    `/counterparties/${id}/notes`,
    { body, kind },
  );
  return data;
}

export async function deleteCounterpartyNote(
  counterpartyId: number,
  noteId: number,
): Promise<void> {
  await api.delete(`/counterparties/${counterpartyId}/notes/${noteId}`);
}

export async function pinCounterparty(
  id: number,
  isPinned: boolean,
): Promise<CounterpartyOut> {
  const { data } = await api.patch<CounterpartyOut>(
    `/counterparties/${id}/pin`,
    { is_pinned: isPinned },
  );
  return data;
}
