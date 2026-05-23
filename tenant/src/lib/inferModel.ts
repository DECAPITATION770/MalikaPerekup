import type { DeviceCategory } from '@/api/devices';

/**
 * Guess brand + category from a model name typed by the user, so the manual
 * "create new model" form pre-fills instead of asking for a brand outright.
 * Best-effort: both fields stay editable. Brand here is a separate concern
 * from the model string — we only fill it when a keyword clearly implies it.
 */

interface BrandRule {
  brand: string;
  /** Keywords (lowercase) that imply this brand when present in the model. */
  keywords: string[];
}

// Order matters: first match wins.
const BRAND_RULES: BrandRule[] = [
  { brand: 'Apple', keywords: ['iphone', 'ipad', 'macbook', 'imac', 'apple watch', 'airpods', 'airpod', 'mac '] },
  { brand: 'Samsung', keywords: ['galaxy', 'samsung'] },
  { brand: 'Xiaomi', keywords: ['xiaomi', 'redmi', 'poco', 'mi '] },
  { brand: 'Huawei', keywords: ['huawei', 'matepad', 'matebook'] },
  { brand: 'Honor', keywords: ['honor'] },
  { brand: 'Realme', keywords: ['realme'] },
  { brand: 'Oppo', keywords: ['oppo'] },
  { brand: 'Vivo', keywords: ['vivo'] },
  { brand: 'Infinix', keywords: ['infinix'] },
  { brand: 'Tecno', keywords: ['tecno'] },
  { brand: 'OnePlus', keywords: ['oneplus', 'one plus'] },
  { brand: 'Google', keywords: ['pixel', 'google'] },
  { brand: 'Lenovo', keywords: ['lenovo', 'thinkpad', 'legion'] },
  { brand: 'Asus', keywords: ['asus', 'zenbook', 'rog '] },
  { brand: 'HP', keywords: ['hp ', 'pavilion', 'elitebook'] },
  { brand: 'Dell', keywords: ['dell', 'xps', 'latitude'] },
];

// Category keywords (lowercase) → device category.
const CATEGORY_RULES: { category: DeviceCategory; keywords: string[] }[] = [
  { category: 'laptop', keywords: ['macbook', 'matebook', 'thinkpad', 'zenbook', 'notebook', 'laptop', 'ноут', 'pavilion', 'elitebook', 'latitude', 'legion', 'xps'] },
  { category: 'tablet', keywords: ['ipad', 'matepad', 'tab ', 'tablet', 'планшет'] },
  { category: 'smartwatch', keywords: ['watch', 'часы', 'band', 'amazfit', 'garmin'] },
  { category: 'accessory', keywords: ['airpods', 'airpod', 'buds', 'наушник', 'jbl', 'anker', 'baseus', 'чехол', 'кабель', 'зарядк'] },
];

export interface InferredModel {
  brand?: string;
  category: DeviceCategory;
}

export function inferBrandCategory(model: string): InferredModel {
  const s = ` ${model.trim().toLowerCase()} `;

  const brand = BRAND_RULES.find((r) => r.keywords.some((k) => s.includes(k)))?.brand;
  const category =
    CATEGORY_RULES.find((r) => r.keywords.some((k) => s.includes(k)))?.category ?? 'phone';

  return { brand, category };
}
