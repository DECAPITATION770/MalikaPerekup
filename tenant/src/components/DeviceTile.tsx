/**
 * DeviceTile — the single leading tile for a device across every list
 * (Stock витрина, the sale picker, …). Brand-tinted background + the device
 * photo, falling back to the category icon in the brand colour.
 *
 * Before this, Stock, the sale step and others each hand-rolled the tile and
 * drifted: Stock rendered a vivid brand-tinted photo while the sale picker
 * showed a flat grey icon, so the *same* device looked like two different
 * apps. Same fix the project already applied to row chrome with `ListRow`.
 */
import {
  Headphones,
  Laptop,
  Package as PackageIcon,
  Smartphone,
  Tablet,
  Watch,
  type LucideIcon,
} from 'lucide-react';

import DevicePhoto from '@/components/DevicePhoto';
import type { DeviceCategory } from '@/api/devices';
import { brandTextColor, brandTint } from '@/lib/brand';
import { useTheme } from '@/lib/theme';

/** Single source of truth for category → icon (Stock filters import this too). */
export const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

interface Props {
  // Joined list endpoints (sales, purchases) can return these as null, and the
  // category as a loose string — tolerate both so the tile is one component
  // everywhere, not "the strict one" and "the loose one".
  brand: string | null | undefined;
  model: string | null | undefined;
  category?: DeviceCategory | string | null;
  photoUrl?: string | null;
}

export default function DeviceTile({ brand, model, category, photoUrl }: Props) {
  const { resolved } = useTheme();
  const b = brand ?? '';
  const Icon = CATEGORY_ICON[category as DeviceCategory] ?? PackageIcon;
  return (
    // Brand-tinted bg sits behind both states; the photo fully covers it when
    // it loads, and shows through as the icon backdrop on failure.
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
      style={{ backgroundColor: brandTint(b, 0.14), color: brandTextColor(b, resolved) }}
    >
      <DevicePhoto
        src={photoUrl}
        alt={`${b} ${model ?? ''}`.trim()}
        fallback={<Icon size={20} strokeWidth={1.8} />}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
