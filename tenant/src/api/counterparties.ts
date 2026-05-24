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
  created_at: string;
  updated_at: string;
}

export interface CounterpartiesQuery {
  q?: string;
  type?: CounterpartyType;
  limit?: number;
  offset?: number;
}

export async function listCounterparties(
  query: CounterpartiesQuery = {},
): Promise<Page<CounterpartyOut>> {
  const { data } = await api.get<Page<CounterpartyOut>>('/counterparties', { params: query });
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
