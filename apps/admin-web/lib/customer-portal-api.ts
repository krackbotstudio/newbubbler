import { api } from './api';

export interface CustomerPortal {
  id: string;
  ownerUserId: string | null;
  branchId: string;
  slug: string;
  brandName: string;
  logoUrl: string | null;
  appIconUrl: string | null;
  termsAndConditions: string | null;
  isActive: boolean;
  carouselImages: Array<{
    id: string;
    portalId: string;
    position: number;
    imageUrl: string;
  }>;
  shareableUrl: string;
}

export interface UpsertCustomerPortalInput {
  brandName: string;
  slug: string;
  termsAndConditions?: string;
  isActive?: boolean;
}

export function getBranchCustomerPortal(branchId: string) {
  return api.get<CustomerPortal | null>(`/admin/customer-portals/branch/${branchId}`).then((r) => r.data);
}

export function upsertBranchCustomerPortal(branchId: string, input: UpsertCustomerPortalInput) {
  return api.put<CustomerPortal>(`/admin/customer-portals/branch/${branchId}`, input).then((r) => r.data);
}

export function uploadBranchPortalLogo(branchId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<CustomerPortal>(`/admin/customer-portals/branch/${branchId}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function uploadBranchPortalAppIcon(branchId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<CustomerPortal>(`/admin/customer-portals/branch/${branchId}/app-icon`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function uploadBranchPortalCarousel(branchId: string, position: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<CustomerPortal>(`/admin/customer-portals/branch/${branchId}/carousel/${position}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

