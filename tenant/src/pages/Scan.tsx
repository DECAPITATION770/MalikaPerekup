/**
 * Scan — open the phone camera, read a device QR sticker, and jump straight
 * to THAT device's card. The lookup is shop-scoped on the backend
 * (`GET /devices/by-token/:token` → 404 for a foreign sticker), so a scan
 * can only ever resolve to a device the current shop owns. A 404 surfaces as
 * a friendly "не из вашего магазина" rather than a dead end.
 *
 * Outside Telegram (desktop / dev) the native scanner is unavailable, so the
 * page falls back to manual code entry — no extra camera dependency shipped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { ArrowLeft, Loader2, QrCode, ScanLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { getDeviceByToken } from '@/api/devices';
import { extractDeviceToken } from '@/lib/qrToken';
import { useTgHaptic, useTgQrScanner } from '@/lib/telegram';

type Phase = 'idle' | 'resolving' | 'not_found' | 'invalid';

export default function Scan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scanner = useTgQrScanner();
  const haptic = useTgHaptic();

  const [phase, setPhase] = useState<Phase>('idle');
  const [manual, setManual] = useState('');
  const supported = scanner.isSupported();
  // Guard against firing two lookups from a double-tap / re-render.
  const busy = useRef(false);

  const resolve = useCallback(
    async (raw: string) => {
      const token = extractDeviceToken(raw);
      if (!token) {
        haptic.notify('error');
        setPhase('invalid');
        return;
      }
      setPhase('resolving');
      try {
        const device = await getDeviceByToken(token);
        haptic.notify('success');
        navigate(`/stock/${device.id}`, { replace: true });
      } catch (err) {
        // 404 = sticker belongs to another shop or the device is gone.
        haptic.notify('error');
        setPhase(isAxiosError(err) && err.response?.status === 404 ? 'not_found' : 'invalid');
      }
    },
    [haptic, navigate],
  );

  const openCamera = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await scanner.scan(t('scan.instruction'));
      if (result) await resolve(result);
      else setPhase('idle'); // user dismissed the camera
    } finally {
      busy.current = false;
    }
  }, [resolve, scanner, t]);

  // Auto-open the camera on first mount when it's available — the whole point
  // of this screen is to scan, so don't make the user tap twice.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (supported && !autoOpened.current) {
      autoOpened.current = true;
      void openCamera();
    }
  }, [supported, openCamera]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manual.trim()) void resolve(manual);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-1.5 text-label font-semibold text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft size={16} /> {t('scan.back')}
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
          {t('scan.title')}
        </h1>
        <p className="text-body text-text-dim">{t('scan.instruction')}</p>
      </div>

      {phase === 'resolving' && (
        <div className="card flex flex-col items-center gap-3 px-6 py-10">
          <Loader2 className="size-6 animate-spin text-accent" />
          <p className="text-label font-semibold text-text-dim">{t('scan.resolving')}</p>
        </div>
      )}

      {phase === 'not_found' && (
        <EmptyState
          illustration={<QrCode className="size-10 text-text-muted" strokeWidth={1.5} />}
          title={t('scan.not_found_title')}
          description={t('scan.not_found_body')}
          action={
            supported && (
              <Button variant="secondary" icon={<ScanLine className="size-4" />} onClick={openCamera}>
                {t('scan.rescan')}
              </Button>
            )
          }
        />
      )}

      {phase === 'invalid' && (
        <EmptyState
          illustration={<QrCode className="size-10 text-text-muted" strokeWidth={1.5} />}
          title={t('scan.invalid_title')}
          description={t('scan.invalid_body')}
          action={
            supported && (
              <Button variant="secondary" icon={<ScanLine className="size-4" />} onClick={openCamera}>
                {t('scan.rescan')}
              </Button>
            )
          }
        />
      )}

      {/* Primary CTA — shown when the camera is available and we're not mid-lookup. */}
      {supported && phase === 'idle' && (
        <Button full icon={<ScanLine className="size-4" />} onClick={openCamera}>
          {t('scan.cta')}
        </Button>
      )}

      {/* Manual fallback — always offered, and the only path when the camera
          isn't available (Telegram Desktop / browser dev). */}
      <form onSubmit={submitManual} className="card flex flex-col gap-3 px-4 py-4">
        <label htmlFor="scan-manual" className="text-label font-semibold text-text-dim">
          {supported ? t('scan.manual_label') : t('scan.unsupported')}
        </label>
        <div className="flex gap-2">
          <Input
            id="scan-manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t('scan.manual_placeholder')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Button type="submit" variant="secondary" disabled={!manual.trim()}>
            {t('scan.manual_submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
