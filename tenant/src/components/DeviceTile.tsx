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
