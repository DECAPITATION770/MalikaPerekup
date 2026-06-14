import api from './client';

export interface UserOut {
  id: number;
  full_name: string;
  language: 'ru' | 'uz';
  tg_username: string | null;
  phone: string | null;
  login: string | null;
  has_password: boolean;
  notifications_enabled: boolean;
  tg_connected: boolean;
  notify_tg_chat_id: number | null;
}

export interface TokenResponse {
  access_token: string;
  user_id: number;
}

export async function loginPassword(login: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { login, password });
  return data;
}

export async function loginTelegram(init_data: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/telegram', { init_data });
  return data;
}

export async function getMe(): Promise<UserOut> {
  const { data } = await api.get<UserOut>('/auth/me');
  return data;
}

export async function setupPassword(login: string, password: string): Promise<void> {
  await api.post('/auth/setup-password', { login, password });
}

export async function updateShop(patch: { name?: string; language_default?: 'ru' | 'uz' }): Promise<void> {
  await api.patch('/shops/me', patch);
}

/** Settings → Уведомления: toggle Telegram reminders + optional override chat. */
export async function updateNotificationPrefs(prefs: {
  enabled: boolean;
  notify_tg_chat_id: number | null;
}): Promise<UserOut> {
  const { data } = await api.patch<UserOut>('/auth/me/notifications', prefs);
  return data;
}
