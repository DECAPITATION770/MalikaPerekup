export interface AdminTokenResponse {
  access_token: string;
  user_id: number;
  is_admin: true;
}

export interface AdminOut {
  id: number;
  tg_id: number | null;
  tg_username: string | null;
  login: string | null;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminCreate {
  full_name: string;
  tg_id?: number | null;
  tg_username?: string | null;
  login?: string | null;
  password?: string | null;
}

export interface AdminUpdate {
  full_name?: string;
  tg_username?: string | null;
  password?: string | null;
  is_active?: boolean;
}

export interface OwnerOut {
  id: number;
  tg_id: number | null;
  tg_username: string | null;
  full_name: string;
  phone: string | null;
  login: string | null;
  has_password: boolean;
  last_login_at: string | null;
  last_login_source: string | null;
  created_at: string;
  is_blocked: boolean;
  blocked_at: string | null;
  avatar_url: string | null;
  client_status: string;
  admin_contact_note: string | null;
}

export interface ShopStats {
  devices_in_stock: number;
  inventory_value_uzs: string;
  sales_total_uzs: string;
  profit_total_uzs: string;
  nasiya_active_plans: number;
  nasiya_debt_uzs: string;
}

export interface ShopAdminOut {
  id: number;
  name: string;
  language_default: 'ru' | 'uz';
  plan: string;
  plan_until: string | null;
  is_frozen: boolean;
  frozen_at: string | null;
  frozen_reason: string | null;
  created_at: string;
  owner: OwnerOut;
}

export interface ShopAdminDetail extends ShopAdminOut {
  stats: ShopStats;
}

export interface AccessAttemptOut {
  id: number;
  attempted_at: string;
  source: string;
  identifier: string;
  tg_username: string | null;
  ip_address: string | null;
  success: boolean;
  reason: string | null;
  user_id: number | null;
}

export interface NasiyaOverdueRow {
  shop_id: number;
  shop_name: string;
  plan_id: number;
  payment_id: number;
  buyer_name: string;
  buyer_phone: string | null;
  device: string;
  due_date: string;
  days_overdue: number;
  amount_due: string;
  remaining: string;
}

export interface NasiyaActiveRow {
  shop_id: number;
  shop_name: string;
  plan_id: number;
  buyer_name: string;
  buyer_phone: string | null;
  device: string;
  next_due_date: string | null;
  remaining: string;
}

export interface PlatformStats {
  shops_total: number;
  shops_active: number;
  shops_frozen: number;
  shops_trial: number;
  shops_paid: number;
  users_total: number;
  nasiya_active_count: number;
  nasiya_overdue_count: number;
  nasiya_total_debt_uzs: string;
  failed_attempts_today: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateShopRequest {
  name: string;
  language_default: 'ru' | 'uz';
  owner_tg_id?: number | null;
  owner_tg_username?: string | null;
  owner_full_name: string;
  owner_phone?: string | null;
  owner_login?: string | null;
  owner_password?: string | null;
}
