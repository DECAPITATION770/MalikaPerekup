import api from './client';

// NB: the axios instance baseURL is already `/api/v1/admin`, so every path
// here is relative to that (`/backup/...`, not `/admin/backup/...`).

export type BackupFrequency = 'off' | 'daily' | 'interval';
export type TgDeliveryMode = 'full_if_fits' | 'db_only' | 'split';
export type BackupStatus = 'running' | 'ok' | 'failed';

export interface BackupConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  daily_time: string | null;
  interval_hours: number | null;
  retention_count: number;
  tg_chat_id: number | null;
  tg_auto_send: boolean;
  tg_delivery_mode: TgDeliveryMode;
  tg_part_size_mb: number;
  updated_at: string;
}

// What the PUT endpoint accepts (everything but the server-managed timestamp).
export type BackupConfigInput = Omit<BackupConfig, 'updated_at'>;

export interface BackupRun {
  id: number;
  created_at: string;
  status: BackupStatus;
  trigger: 'manual' | 'auto';
  filename: string | null;
  size_bytes: number | null;
  object_count: number | null;
  sent_to_tg: boolean;
  error: string | null;
}

export const getConfig = () =>
  api.get<BackupConfig>('/backup/config').then((r) => r.data);

export const putConfig = (c: BackupConfigInput) =>
  api.put<BackupConfig>('/backup/config', c).then((r) => r.data);

export const listRuns = () =>
  api.get<BackupRun[]>('/backup/runs').then((r) => r.data);

export const runNow = () =>
  api.post<BackupRun>('/backup/run').then((r) => r.data);

export const sendTg = (id: number) =>
  api.post<BackupRun>(`/backup/runs/${id}/send-telegram`).then((r) => r.data);

/** Download via axios so the Bearer token (added by the request interceptor)
 *  is sent — a plain <a href> would hit the auth-guarded endpoint without it. */
export const downloadBackup = async (id: number, filename: string) => {
  const res = await api.get(`/backup/runs/${id}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const restore = (file: File, force: boolean) => {
  const fd = new FormData();
  fd.append('file', file);
  // Content-Type undefined → browser sets multipart/form-data with boundary.
  return api.post(`/backup/restore?force=${force}`, fd, {
    headers: { 'Content-Type': undefined },
  });
};
