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
