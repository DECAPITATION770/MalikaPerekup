import api from './client';

export type DeviceCategory = 'phone' | 'tablet' | 'laptop' | 'smartwatch' | 'accessory' | 'other';
export type DeviceCondition = 'new' | 'good' | 'normal' | 'broken';
export type DeviceStatus = 'in_stock' | 'reserved' | 'sold' | 'returned' | 'written_off';

export interface DeviceOut {
  id: number;
  category: DeviceCategory;
  brand: string;
  model: string;
  imei: string | null;
  serial: string | null;
  condition: DeviceCondition;
  specs: Record<string, unknown>;
  photos: string[];
  defects: string[];
  status: DeviceStatus;
  qr_token: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by ``GET /devices`` — adds purchase price + age for the
 *  Stock table. Single-item endpoints (``GET /devices/:id``) still use
 *  ``DeviceOut``. */
export interface DeviceWithPurchaseOut extends DeviceOut {
  purchase_price_uzs: string | null;
  purchase_date: string | null;
  days_in_stock: number | null;
  /** Signed GET URL for the first photo (list thumbnails); null if no photos. */
  photo_url: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type DeviceSort = 'recent' | 'days' | 'price_asc' | 'price_desc';

export interface DevicesQuery {
  q?: string;
  status?: DeviceStatus;
  category?: DeviceCategory;
  condition?: DeviceCondition;
  brand?: string;
  price_min?: string;
  price_max?: string;
  sort?: DeviceSort;
  limit?: number;
  offset?: number;
}

export async function listDevices(query: DevicesQuery = {}): Promise<Page<DeviceWithPurchaseOut>> {
  const { data } = await api.get<Page<DeviceWithPurchaseOut>>('/devices', { params: query });
  return data;
}

export async function getDevice(id: number): Promise<DeviceOut> {
  const { data } = await api.get<DeviceOut>(`/devices/${id}`);
  return data;
}

export async function getDeviceByToken(token: string): Promise<DeviceOut> {
  const { data } = await api.get<DeviceOut>(`/devices/by-token/${token}`);
  return data;
}

/** Short-lived signed GET URLs for a device's photos (private ACL → can't
 *  render the raw S3 keys). Order matches ``device.photos``. */
export async function getDevicePhotoUrls(id: number): Promise<string[]> {
  const { data } = await api.get<{ urls: string[] }>(`/devices/${id}/photo-urls`);
  return data.urls;
}

/** Printable QR sticker PNG. Fetched as a blob so the auth header is sent
 *  (a plain <img src> can't carry the Bearer token). */
export async function getDeviceQrPng(id: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/devices/${id}/qr.png`, { responseType: 'blob' });
  return data;
}

export interface SuggestOut {
  values: string[];
}

export async function getDeviceSuggestions(params: {
  field: 'brand' | 'model';
  q?: string;
  brand?: string;
  limit?: number;
}): Promise<string[]> {
  const { data } = await api.get<SuggestOut>('/devices/suggestions', { params });
  return data.values;
}

export interface ImeiCheckOut {
  found: boolean;
  status: DeviceStatus | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null; // ISO date
  seller_name: string | null;
}

export async function checkImei(imei: string): Promise<ImeiCheckOut> {
  const { data } = await api.get<ImeiCheckOut>('/devices/imei-check', {
    params: { imei },
  });
  return data;
}

// ─── Purchase-wizard endpoints ─────────────────────────────────────────

export interface RecentModelOut {
  brand: string;
  model: string;
  category: DeviceCategory;
}

export interface RecentModelsOut {
  items: RecentModelOut[];
}

/** Top-N most-recent (brand, model, category) chips for wizard step 1. */
export async function getRecentModels(limit = 10): Promise<RecentModelOut[]> {
  const { data } = await api.get<RecentModelsOut>('/devices/recent-models', {
    params: { limit },
  });
  return data.items;
}

export interface PriceHintOut {
  count: number;
  last_price_uzs: string | null;
  avg_price_uzs: string | null;
}

/** Past purchase prices for this brand+model (wizard step 4 hint). */
export async function getPriceHint(brand: string, model: string): Promise<PriceHintOut> {
  const { data } = await api.get<PriceHintOut>('/devices/price-hint', {
    params: { brand, model },
  });
  return data;
}

export interface UploadUrlResponse {
  url: string;
  key: string;
}

/** Sign a presigned PUT URL for a device photo (wizard step 2). */
export async function requestDeviceUploadUrl(filename: string): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>('/devices/upload-url', { filename });
  return data;
}
