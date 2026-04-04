import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AnalyticsPreset,
  AnalyticsResponse,
  DashboardKpisResponse,
  CompletedCatalogItemQuantity,
} from '@/types';

/** Presets that trigger API (exclude CUSTOM). */
export type RevenuePreset = Exclude<AnalyticsPreset, 'CUSTOM'>;

function fetchDashboardKpis(): Promise<DashboardKpisResponse> {
  return api.get<DashboardKpisResponse>('/admin/analytics/dashboard-kpis').then((r) => r.data);
}

export function useDashboardKpis(options?: { enabled?: boolean; refetchInterval?: number }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ['admin', 'analytics', 'dashboard-kpis'],
    queryFn: fetchDashboardKpis,
    enabled,
    refetchInterval: options?.refetchInterval,
  });
}

function fetchRevenue(
  preset?: RevenuePreset,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string
): Promise<AnalyticsResponse> {
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (branchId) params.set('branchId', branchId);
  const q = params.toString();
  return api
    .get<AnalyticsResponse>(`/admin/analytics/revenue${q ? `?${q}` : ''}`)
    .then((r) => r.data);
}

export interface UseAnalyticsRevenueOptions {
  preset?: AnalyticsPreset;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string | null;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useAnalyticsRevenue(options: UseAnalyticsRevenueOptions) {
  const { preset, dateFrom, dateTo, branchId, enabled = true, refetchInterval } = options;
  const usePreset = preset && preset !== 'CUSTOM';
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', { preset, dateFrom, dateTo, branchId }],
    queryFn: () =>
      fetchRevenue(
        usePreset ? (preset as RevenuePreset) : undefined,
        dateFrom,
        dateTo,
        branchId ?? undefined
      ),
    enabled,
    refetchInterval,
  });
}

function fetchCompletedCatalogItems(
  preset?: RevenuePreset,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string
): Promise<CompletedCatalogItemQuantity[]> {
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (branchId) params.set('branchId', branchId);
  const q = params.toString();
  return api
    .get<CompletedCatalogItemQuantity[]>(`/admin/analytics/completed-catalog-items${q ? `?${q}` : ''}`)
    .then((r) => r.data);
}

export function useAnalyticsCompletedCatalogItems(options: UseAnalyticsRevenueOptions) {
  const { preset, dateFrom, dateTo, branchId, enabled = true } = options;
  const usePreset = preset && preset !== 'CUSTOM';
  return useQuery({
    queryKey: ['admin', 'analytics', 'completed-catalog-items', { preset, dateFrom, dateTo, branchId }],
    queryFn: () =>
      fetchCompletedCatalogItems(
        usePreset ? (preset as RevenuePreset) : undefined,
        dateFrom,
        dateTo,
        branchId ?? undefined
      ),
    enabled,
  });
}
