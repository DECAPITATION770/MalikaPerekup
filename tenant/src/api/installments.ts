import api from './client';
import type { Page } from './devices';

export type PlanStatus = 'active' | 'completed' | 'overdue' | 'cancelled';
export type PeriodType = 'daily' | 'weekly' | 'monthly';

export interface PlanOut {
  id: number;
  sale_id: number;
  total_amount: string;
  down_payment: string;
  period_type: PeriodType;
  period_count: number;
  start_date: string;
  status: PlanStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;

  // Debtor contact (joined from sale + counterparty on the list endpoint)
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_tg_username: string | null;

  // Device being paid off + debtor directory id (list endpoint only)
  device_id: number | null;
  device_brand: string | null;
  device_model: string | null;
  counterparty_id: number | null;

  // Aggregate payment progress (list endpoint only — null on single-plan)
  paid_amount: string | null;
  paid_count: number | null;
  payments_count: number | null;
}

export async function listInstallments(params?: { status?: PlanStatus; limit?: number; offset?: number }): Promise<Page<PlanOut>> {
  const { data } = await api.get<Page<PlanOut>>('/installments', { params });
  return data;
}

export async function makePayment(planId: number, amount: string): Promise<void> {
  await api.post(`/installments/${planId}/payments`, { amount });
}

export async function payoff(planId: number): Promise<void> {
  await api.post(`/installments/${planId}/payoff`);
}
