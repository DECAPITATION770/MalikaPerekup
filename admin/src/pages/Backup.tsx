/**
 * Backup admin page — schedule/retention/Telegram settings, manual backup,
 * run history (download + send to Telegram), and a guarded restore upload.
 * Platform-admin only (the API enforces it).
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  Loader2,
  Play,
  Send,
  Save,
  Upload,
} from 'lucide-react';

import {
  getConfig,
  listRuns,
  putConfig,
  runNow,
  sendTg,
  downloadBackup,
  restore,
  type BackupConfigInput,
  type BackupRun,
} from '../api/backup';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/switch';
import QueryError from '../components/ui/QueryError';
import { Skeleton } from '../components/ui/Skeleton';
import { fmtDateTime } from '../lib/fmt';
import { cn } from '@/lib/utils';

const SELECT_CLS =
  'h-10 rounded-lg border border-border bg-bg2 px-3 text-label font-medium text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';

function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

const STATUS_CLS: Record<BackupRun['status'], string> = {
  ok: 'text-success',
  failed: 'text-danger',
  running: 'text-warning',
};

export default function Backup() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const configQuery = useQuery({ queryKey: ['backup', 'config'], queryFn: getConfig });
  const runsQuery = useQuery({ queryKey: ['backup', 'runs'], queryFn: listRuns });

  const [form, setForm] = useState<BackupConfigInput | null>(null);
  useEffect(() => {
    if (configQuery.data) {
      const { updated_at: _ignore, ...rest } = configQuery.data;
      setForm(rest);
    }
  }, [configQuery.data]);

  const saveMut = useMutation({
    mutationFn: (c: BackupConfigInput) => putConfig(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup', 'config'] });
      toast.success(t('backup.saved'));
    },
    onError: () => toast.error(t('backup.save_error')),
  });

  const runMut = useMutation({
    mutationFn: runNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup', 'runs'] });
      toast.success(t('backup.run_done'));
    },
    onError: () => toast.error(t('backup.run_error')),
  });

  const sendMut = useMutation({
    mutationFn: (id: number) => sendTg(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup', 'runs'] });
      toast.success(t('backup.sent'));
    },
    onError: () => toast.error(t('backup.send_error')),
  });

  // ─── Restore ──────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const restoreMut = useMutation({
    mutationFn: (file: File) => restore(file, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup'] });
      toast.success(t('backup.restore_done'));
      setRestoreFile(null);
      setRestoreConfirm(false);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: () => toast.error(t('backup.restore_error')),
  });

  const set = <K extends keyof BackupConfigInput>(k: K, v: BackupConfigInput[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <header className="fia">
        <h1 className="text-title font-bold tracking-tight">{t('backup.title')}</h1>
        <p className="mt-0.5 text-hint text-text-dim">{t('backup.subtitle')}</p>
      </header>

      {/* ─── Settings ─────────────────────────────────────────────── */}
      <section className="card fia fia-1 flex flex-col gap-5 p-6">
        <h2 className="text-label font-semibold tracking-tight">{t('backup.settings')}</h2>

        {configQuery.isLoading || !form ? (
          <Skeleton className="h-40 w-full" />
        ) : configQuery.isError ? (
          <QueryError onRetry={() => configQuery.refetch()} error={configQuery.error} />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Schedule */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-label font-medium">{t('backup.enabled')}</label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => set('enabled', v)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-caption font-medium text-text-dim">
                  {t('backup.frequency')}
                </label>
                <select
                  className={SELECT_CLS}
                  value={form.frequency}
                  onChange={(e) =>
                    set('frequency', e.target.value as BackupConfigInput['frequency'])
                  }
                >
                  <option value="off">{t('backup.freq_off')}</option>
                  <option value="daily">{t('backup.freq_daily')}</option>
                  <option value="interval">{t('backup.freq_interval')}</option>
                </select>
              </div>

              {form.frequency === 'daily' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-medium text-text-dim">
                    {t('backup.daily_time')}
                  </label>
                  <Input
                    type="time"
                    value={form.daily_time ?? ''}
                    onChange={(e) => set('daily_time', e.target.value || null)}
                  />
                </div>
              )}

              {form.frequency === 'interval' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-medium text-text-dim">
                    {t('backup.interval_hours')}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={form.interval_hours ?? ''}
                    onChange={(e) =>
                      set('interval_hours', e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-caption font-medium text-text-dim">
                  {t('backup.retention_count')}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.retention_count}
                  onChange={(e) => set('retention_count', Number(e.target.value))}
                />
              </div>
            </div>

            {/* Telegram delivery */}
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg2 p-4">
              <h3 className="text-caption font-semibold uppercase tracking-wide text-text-muted">
                {t('backup.tg_section')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-medium text-text-dim">
                    {t('backup.tg_chat_id')}
                  </label>
                  <Input
                    type="number"
                    value={form.tg_chat_id ?? ''}
                    onChange={(e) =>
                      set('tg_chat_id', e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-medium text-text-dim">
                    {t('backup.tg_delivery_mode')}
                  </label>
                  <select
                    className={SELECT_CLS}
                    value={form.tg_delivery_mode}
                    onChange={(e) =>
                      set(
                        'tg_delivery_mode',
                        e.target.value as BackupConfigInput['tg_delivery_mode'],
                      )
                    }
                  >
                    <option value="full_if_fits">{t('backup.mode_full')}</option>
                    <option value="db_only">{t('backup.mode_db_only')}</option>
                    <option value="split">{t('backup.mode_split')}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-medium text-text-dim">
                    {t('backup.tg_part_size_mb')}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={49}
                    value={form.tg_part_size_mb}
                    onChange={(e) => set('tg_part_size_mb', Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 sm:pt-6">
                  <label className="text-label font-medium">{t('backup.tg_auto_send')}</label>
                  <Switch
                    checked={form.tg_auto_send}
                    onCheckedChange={(v) => set('tg_auto_send', v)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => form && saveMut.mutate(form)}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {t('backup.save')}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Manual backup + history ──────────────────────────────── */}
      <section className="card fia fia-2 flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-label font-semibold tracking-tight">{t('backup.history')}</h2>
          <Button
            variant="secondary"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
          >
            {runMut.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            {t('backup.run_now')}
          </Button>
        </div>

        {runsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : runsQuery.isError ? (
          <QueryError onRetry={() => runsQuery.refetch()} error={runsQuery.error} />
        ) : !runsQuery.data?.length ? (
          <div className="flex flex-col items-center gap-3 py-12 text-text-dim">
            <DatabaseBackup size={28} className="opacity-40" aria-hidden />
            <span className="text-label">{t('backup.empty')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-label">
              <thead>
                <tr className="border-b border-border text-caption font-semibold text-text-muted">
                  <th className="px-3 py-2 text-left">{t('backup.col_date')}</th>
                  <th className="px-3 py-2 text-left">{t('backup.col_status')}</th>
                  <th className="px-3 py-2 text-right">{t('backup.col_size')}</th>
                  <th className="px-3 py-2 text-right">{t('backup.col_objects')}</th>
                  <th className="px-3 py-2 text-center">{t('backup.col_tg')}</th>
                  <th className="px-3 py-2 text-right">{t('backup.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsQuery.data.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-2.5 font-mono text-caption text-text-dim">
                      {fmtDateTime(run.created_at)}
                    </td>
                    <td className={cn('px-3 py-2.5 font-medium', STATUS_CLS[run.status])}>
                      {t(`backup.status_${run.status}`)}
                      {run.error && (
                        <span className="ml-1 text-caption text-text-muted" title={run.error}>
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-caption">
                      {fmtBytes(run.size_bytes)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-caption">
                      {run.object_count ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {run.sent_to_tg ? '✓' : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {run.status === 'ok' && run.filename && (
                          <>
                            <button
                              type="button"
                              title={t('backup.download')}
                              className="text-text-dim hover:text-accent"
                              onClick={() => downloadBackup(run.id, run.filename!)}
                            >
                              <Download size={16} />
                            </button>
                            <button
                              type="button"
                              title={t('backup.send_tg')}
                              className="text-text-dim hover:text-accent disabled:opacity-40"
                              disabled={sendMut.isPending}
                              onClick={() => sendMut.mutate(run.id)}
                            >
                              <Send size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Restore ──────────────────────────────────────────────── */}
      <section className="card fia fia-3 flex flex-col gap-4 border-danger/40 p-6">
        <h2 className="text-label font-semibold tracking-tight text-danger">
          {t('backup.restore_title')}
        </h2>
        <div className="flex items-start gap-2 rounded-lg bg-danger-faded p-3 text-hint text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{t('backup.restore_warning')}</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".gz,.tar.gz,application/gzip"
          onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
          className="text-label text-text-dim file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-bg3 file:px-3 file:py-2 file:text-label file:text-text"
        />

        <label className="flex items-center gap-2 text-label text-text-dim">
          <input
            type="checkbox"
            checked={restoreConfirm}
            onChange={(e) => setRestoreConfirm(e.target.checked)}
          />
          {t('backup.restore_confirm')}
        </label>

        <div className="flex justify-end">
          <Button
            variant="danger"
            disabled={!restoreFile || !restoreConfirm || restoreMut.isPending}
            onClick={() => restoreFile && restoreMut.mutate(restoreFile)}
          >
            {restoreMut.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}
            {t('backup.restore_button')}
          </Button>
        </div>
      </section>
    </div>
  );
}
