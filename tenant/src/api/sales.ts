import api from './client';
import type { Page } from './devices';

export type SaleType = 'cash' | 'nasiya';

export interface SaleOut {
  id: number;
  device_id: number;
  counterparty_id: number | null;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_doc_type: string | null;
  buyer_doc_number: string | null;
  buyer_photos: string[];
  sale_type: SaleType;
  currency: 'UZS' | 'USD';
  // Backend serialises sale_price_uzs / sale_price_usd; earlier the TS
  // type wrongly used `price`/`price_uzs` so values rendered as undefined.
  sale_price_uzs: string;
  sale_price_usd: string | null;
  exchange_rate: string | null;
  profit_uzs: string;
  purchase_price_uzs_snapshot: string;
  sale_date: string;
  comment: string | null;
  status: 'active' | 'returned' | 'cancelled';
  return_reason: string | null;
  returned_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined from the device on list endpoints.
  device_brand: string | null;
  device_model: string | null;
  device_imei: string | null;
  device_category: string | null;
}

export interface UploadUrlResponse { url: string; key: string }

export async function requestSaleUploadUrl(filename: string): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>('/sales/upload-url', { filename });
  return data;
}

export interface BuyerCreate {
  full_name: string;
  phone?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  tg_username?: string | null;
  photos?: string[];
}

export interface SaleCreate {
  device_id: number;
  buyer: BuyerCreate;
  sale_type?: SaleType;
  currency: 'UZS' | 'USD';
  price: string;
  exchange_rate?: string | null;
  sale_date: string;
  comment?: string | null;
  /** Nasiya schedule — sent with the sale so both are created atomically. */
  installment?: InstallmentCreate;
}

export interface InstallmentCreate {
  total_amount: string;
  down_payment?: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_count: number;
  start_date: string;
}

export async function createSale(body: SaleCreate): Promise<SaleOut> {
  const { data } = await api.post<SaleOut>('/sales', body);
  return data;
}

export async function createInstallmentPlan(saleId: number, body: InstallmentCreate): Promise<void> {
  await api.post(`/sales/${saleId}/installments`, body);
}

export async function listSales(params?: { from?: string; to?: string; type?: SaleType; limit?: number; offset?: number }): Promise<Page<SaleOut>> {
  const { data } = await api.get<Page<SaleOut>>('/sales', { params });
  return data;
}

export async function getSalesByDevice(deviceId: number): Promise<SaleOut[]> {
  const { data } = await api.get<SaleOut[]>(`/sales/by-device/${deviceId}`);
  return data;
}

/** Process a buyer return — flips the device back to in_stock. */
export async function returnSale(saleId: number, reason?: string): Promise<SaleOut> {
  const { data } = await api.post<SaleOut>(`/sales/${saleId}/return`, {
    reason: reason?.trim() || null,
  });
  return data;
}
