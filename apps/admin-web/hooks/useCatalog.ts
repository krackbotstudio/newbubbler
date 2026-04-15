import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  LaundryItem,
  CreateItemBody,
  PatchItemBody,
  PutItemPricesBody,
  LaundryItemPrice,
  CatalogMatrixResponse,
  UpdateItemWithMatrixBody,
  ImportCatalogResult,
} from '@/types';

const CATALOG_MATRIX_KEY_PREFIX = ['admin', 'catalog', 'matrix'] as const;

function fetchItems(withPrices = false): Promise<LaundryItem[]> {
  const url = withPrices ? '/admin/items?withPrices=true' : '/admin/items';
  return api.get<LaundryItem[]>(url).then((r) => r.data);
}

export function useCatalogItems() {
  return useQuery({
    queryKey: ['admin', 'items'],
    queryFn: () => fetchItems(false),
  });
}

/** Catalog items including prices per service (for invoice builder). */
export function useCatalogItemsWithPrices() {
  return useQuery({
    queryKey: ['admin', 'items', 'withPrices'],
    queryFn: () => fetchItems(true),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemBody) =>
      api.post<LaundryItem>('/admin/items', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useUpdateItem(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchItemBody) =>
      api.patch<LaundryItem>(`/admin/items/${itemId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete(`/admin/items/${encodeURIComponent(itemId)}`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function usePutItemPrices(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PutItemPricesBody) =>
      api.put<LaundryItemPrice[]>(`/admin/items/${itemId}/prices`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
    },
  });
}

export function useCatalogItemsWithMatrix(branchId?: string) {
  const keyBranch = branchId?.trim() || 'all';
  return useQuery({
    queryKey: [...CATALOG_MATRIX_KEY_PREFIX, keyBranch],
    queryFn: () => {
      const q = branchId?.trim() ? `?branchId=${encodeURIComponent(branchId.trim())}` : '';
      return api.get<CatalogMatrixResponse>(`/admin/catalog/items${q}`).then((r) => ({
        items: r.data.items,
        serviceCategories: r.data.serviceCategories,
        segmentCategories: r.data.segmentCategories ?? [],
      }));
    },
  });
}

export function useUpdateItemWithMatrix(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateItemWithMatrixBody) =>
      api
        .put<{ item: LaundryItem; segmentPrices: unknown[] }>(`/admin/catalog/items/${itemId}`, body)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
    },
  });
}

export function useCreateServiceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; label: string; isActive?: boolean; branchId: string }) =>
      api
        .post<{ id: string; branchId: string; code: string; label: string; isActive: boolean }>(
          '/admin/catalog/service-categories',
          body,
        )
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useCreateSegmentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; label: string; isActive?: boolean; branchId: string }) =>
      api
        .post<{ id: string; branchId: string; code: string; label: string; isActive: boolean }>('/admin/catalog/segments', body)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useUpdateServiceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label, isActive }: { id: string; label?: string; isActive?: boolean }) =>
      api.patch<{ id: string; code: string; label: string; isActive: boolean }>(`/admin/catalog/service-categories/${id}`, { label, isActive }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useDeleteServiceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin/catalog/service-categories/${id}`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useUpdateSegmentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label, isActive }: { id: string; label?: string; isActive?: boolean }) =>
      api.patch<{ id: string; branchId: string; code: string; label: string; isActive: boolean }>(`/admin/catalog/segments/${id}`, { label, isActive }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useDeleteSegmentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin/catalog/segments/${id}`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
    },
  });
}

export function useImportCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; branchId: string }) =>
      api.post<ImportCatalogResult>('/admin/catalog/import', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_MATRIX_KEY_PREFIX, exact: false });
      qc.invalidateQueries({ queryKey: ['admin', 'items'] });
    },
  });
}

export function useImportSample() {
  return useQuery({
    queryKey: ['admin', 'catalog', 'import', 'sample'],
    queryFn: () =>
      api.get<{ content: string }>('/admin/catalog/import/sample').then((r) => r.data.content),
  });
}

/** Upload a custom catalog icon (PNG/JPG). Returns the URL to store on the item (icon field). */
export function useUploadCatalogIcon() {
  return useMutation({
    mutationFn: async ({ file, key }: { file: File; key?: string }): Promise<string> => {
      const form = new FormData();
      form.append('file', file);
      const query = key ? `?key=${encodeURIComponent(key)}` : '';
      const res = await api.post<{ url: string }>(`/admin/catalog/icon/upload${query}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.url;
    },
  });
}
