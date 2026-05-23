import api from './client';
import type { DeviceCategory, Page, UploadUrlResponse } from './devices';

export interface CatalogModelOut {
  id: number;
  category: DeviceCategory;
  brand: string;
  model: string;
  default_specs: Record<string, unknown>;
  photos: string[];
  /** Short-lived signed GET URLs for `photos`, in stored order. */
  photo_urls: string[];
  /** How many purchases referenced this model — used to rank "Частые". */
  purchase_count: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogQuery {
  q?: string;
  category?: DeviceCategory;
  limit?: number;
  offset?: number;
}

export interface CatalogModelInput {
  category: DeviceCategory;
  brand: string;
  model: string;
  default_specs?: Record<string, unknown>;
  photos?: string[];
}

export async function listCatalog(query: CatalogQuery = {}): Promise<Page<CatalogModelOut>> {
  const { data } = await api.get<Page<CatalogModelOut>>('/catalog', { params: query });
  return data;
}

export async function getCatalogModel(id: number): Promise<CatalogModelOut> {
  const { data } = await api.get<CatalogModelOut>(`/catalog/${id}`);
  return data;
}

export async function createCatalogModel(input: CatalogModelInput): Promise<CatalogModelOut> {
  const { data } = await api.post<CatalogModelOut>('/catalog', input);
  return data;
}

export async function updateCatalogModel(
  id: number,
  patch: Partial<CatalogModelInput>,
): Promise<CatalogModelOut> {
  const { data } = await api.patch<CatalogModelOut>(`/catalog/${id}`, patch);
  return data;
}

export async function deleteCatalogModel(id: number): Promise<void> {
  await api.delete(`/catalog/${id}`);
}

export async function requestCatalogUploadUrl(filename: string): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>('/catalog/upload-url', { filename });
  return data;
}
