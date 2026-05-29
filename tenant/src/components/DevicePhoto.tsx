/**
 * Image with a graceful fallback. MinIO presigned URLs can 404 (key deleted,
 * link expired, demo data drift) — without an error handler the browser shows
 * its broken-image glyph mid-list. We render `fallback` in that case so the
 * chrome stays clean. Also accepts an `alt` for screen-readers (the inline
 * `<img>` sites used `alt=""` everywhere).
 */
import { useState, type ReactNode } from 'react';

interface Props {
  src: string | null | undefined;
  alt: string;
  /** Rendered when src is missing or the network image fails to load. */
  fallback: ReactNode;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** Intrinsic dimensions — preventing CLS as the image loads. Callers wrap
   *  us in a fixed-size tile (`h-11 w-11`, `aspect-square`…) so the actual
   *  rendered size is dictated by CSS, but the `<img>` still benefits from
   *  intrinsic hints for the layout pass. Defaults to 64×64 — small enough
   *  to suit chips, large enough that the browser can up-scale crisply. */
  width?: number;
  height?: number;
}

export default function DevicePhoto({
  src,
  alt,
  fallback,
  className,
  loading = 'lazy',
  width = 64,
  height = 64,
}: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      // Async decoding lets the browser paint the rest of the row first and
      // slot the image in when ready — important on long lists where dozens
      // of presigned URLs resolve in parallel.
      decoding="async"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
