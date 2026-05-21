import api from './client';
import type { DeviceCategory, DeviceCondition, DeviceOut, Page } from './devices';

export type Currency = 'UZS' | 'USD';

export interface DeviceOnPurchase {
  category: DeviceCategory;
  brand: string;
  model: string;
  imei?: string | null;
  serial?: string | null;
  condition: DeviceCondition;
  specs?: Record<string, unknown>;
  photos?: string[];
  defects?: string[];
  notes?: string | null;
}

export interface SellerOnPurchase {
  full_name: string;
  phone?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  photos?: string[];
  tg_username?: string | null;
}

export interface PurchaseCreate {
  device: DeviceOnPurchase;
  seller: SellerOnPurchase;
  currency: Currency;
  price: string;
  exchange_rate?: string | null;
  purchase_date: string;
  comment?: string | null;
}

export interface PurchaseOut {
  id: number;
  device_id: number;
  counterparty_id: number | null;
  seller_name: string;
  seller_phone: string | null;
  seller_doc_type: string | null;
  seller_doc_number: string | null;
  seller_photos: string[];
  currency: Currency;
  price_uzs: string;
  price_usd: string | null;
  exchange_rate: string | null;
  purchase_date: string;
  comment: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined from the device on list endpoints (null on single-item endpoints).
  device_brand: string | null;
  device_model: string | null;
  device_imei: string | null;
  device_category: string | null;
}

export interface UploadUrlResponse { url: string; key: string }

export async function requestPurchaseUploadUrl(filename: string): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>('/purchases/upload-url', { filename });
  return data;
}

export interface PurchaseWithDeviceOut extends PurchaseOut {
  device: DeviceOut;
}

export async function createPurchase(payload: PurchaseCreate): Promise<PurchaseWithDeviceOut> {
  const { data } = await api.post<PurchaseWithDeviceOut>('/purchases', payload);
  return data;
}

export interface PurchasesQuery {
  from?: string;
  to?: string;
  counterparty_id?: number;
  limit?: number;
  offset?: number;
}

export async function listPurchases(query: PurchasesQuery = {}): Promise<Page<PurchaseOut>> {
  const { data } = await api.get<Page<PurchaseOut>>('/purchases', { params: query });
  return data;
}

export async function getPurchaseByDevice(deviceId: number): Promise<PurchaseOut> {
  const { data } = await api.get<PurchaseOut>(`/purchases/by-device/${deviceId}`);
  return data;
}

// ─── Wizard "🔁 Повторить последнюю" template ─────────────────────────

export interface LastPurchaseDeviceTemplate {
  category: DeviceCategory;
  brand: string;
  model: string;
  condition: DeviceCondition;
  specs: Record<string, unknown>;
  defects: string[];
}

export interface LastPurchaseSellerTemplate {
  counterparty_id: number | null;
  full_name: string;
  phone: string | null;
  doc_type: string | null;
  doc_number: string | null;
  tg_username: string | null;
}

export interface LastPurchaseTemplate {
  device: LastPurchaseDeviceTemplate;
  seller: LastPurchaseSellerTemplate;
}

/** Most recent purchase as a wizard-fill template. Returns `null` if shop has none. */
export async function getLastPurchase(): Promise<LastPurchaseTemplate | null> {
  try {
    const { data } = await api.get<LastPurchaseTemplate>('/purchases/last');
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
}
