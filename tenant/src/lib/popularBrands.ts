/** Hardcoded popular brand chips for the wizard's step 1 "+ другая модель"
 *  fallback. Curated for the Malika electronics market in Tashkent —
 *  ~12 phones, fewer per other category (long tail handled by free input). */

import type { DeviceCategory } from '../api/devices';

export const POPULAR_BRANDS: Record<DeviceCategory, string[]> = {
  phone: [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Realme',
    'Honor',
    'Oppo',
    'Infinix',
    'Tecno',
    'Vivo',
    'Huawei',
    'OnePlus',
    'Google',
  ],
  tablet: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Lenovo', 'Honor'],
  laptop: ['Apple', 'Lenovo', 'HP', 'Dell', 'ASUS', 'Acer', 'MSI', 'Huawei'],
  smartwatch: ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Amazfit', 'Garmin'],
  accessory: ['Apple', 'Samsung', 'Xiaomi', 'JBL', 'Anker', 'Baseus'],
  other: [],
};
