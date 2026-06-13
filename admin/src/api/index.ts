import api from './client';
import type {
  AdminOut, AdminTokenResponse, ShopAdminOut, ShopAdminDetail,
  AccessAttemptOut, NasiyaOverdueRow, NasiyaActiveRow,
  PlatformStats, Page, CreateShopRequest, OwnerOut,
} from '../types';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const loginPassword = (login: string, password: string) =>
  api.post<AdminTokenResponse>('/auth/login', { login, password }).then(r => r.data);

export const loginTelegram = (init_data: string) =>
  api.post<AdminTokenResponse>('/auth/telegram', { init_data }).then(r => r.data);

export const getMe = () =>
  api.get<AdminOut>('/me').then(r => r.data);

// ─── Shops ─────────────────────────────────────────────────────────────────

interface ShopsParams {
  limit?: number; offset?: number;
  q?: string; plan?: string; frozen?: boolean;
}

export const getShops = (params: ShopsParams = {}) =>
  api.get<Page<ShopAdminOut>>('/shops', { params }).then(r => r.data);

export const getShop = (id: number) =>
  api.get<ShopAdminDetail>(`/shops/${id}`).then(r => r.data);

export const createShop = (data: CreateShopRequest) =>
  api.post<ShopAdminOut>('/shops', data).then(r => r.data);

export const updateShop = (id: number, data: { plan?: string; plan_until?: string | null }) =>
  api.patch<ShopAdminOut>(`/shops/${id}`, data).then(r => r.data);

export const freezeShop = (id: number, reason?: string) =>
  api.post<ShopAdminOut>(`/shops/${id}/freeze`, { reason }).then(r => r.data);

export const unfreezeShop = (id: number) =>
  api.post<ShopAdminOut>(`/shops/${id}/unfreeze`).then(r => r.data);

export const setOwnerCredentials = (shopId: number, data: { login?: string; password?: string }) =>
  api.post<OwnerOut>(`/shops/${shopId}/owner/credentials`, data).then(r => r.data);

// ─── Access log ────────────────────────────────────────────────────────────

interface LogParams {
  limit?: number; offset?: number;
  source?: string; success?: boolean;
  from?: string; to?: string;
}

export const getAccessLog = (params: LogParams = {}) =>
  api.get<Page<AccessAttemptOut>>('/access-attempts', { params }).then(r => r.data);

// ─── Nasiya ────────────────────────────────────────────────────────────────

export const getNasiyaOverdue = () =>
  api.get<NasiyaOverdueRow[]>('/nasiya/overdue').then(r => r.data);

export const getNasiyaActive = () =>
  api.get<NasiyaActiveRow[]>('/nasiya/active').then(r => r.data);

// ─── Stats ─────────────────────────────────────────────────────────────────

export const getPlatformStats = () =>
  api.get<PlatformStats>('/stats').then(r => r.data);

// ─── Users ─────────────────────────────────────────────────────────────────

interface UsersParams { q?: string; limit?: number; offset?: number }

export const getUsers = (params: UsersParams = {}) =>
  api.get<Page<OwnerOut>>('/users', { params }).then(r => r.data);

export const getUser = (id: number) =>
  api.get<OwnerOut>(`/users/${id}`).then(r => r.data);

export const blockUser = (id: number) =>
  api.post<OwnerOut>(`/users/${id}/block`).then(r => r.data);

export const unblockUser = (id: number) =>
  api.post<OwnerOut>(`/users/${id}/unblock`).then(r => r.data);

export const updateUserContact = (
  id: number,
  data: { phone: string | null; admin_contact_note: string | null },
) => api.patch<OwnerOut>(`/users/${id}/contact`, data).then(r => r.data);
