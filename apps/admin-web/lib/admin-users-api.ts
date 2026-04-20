import { api } from './api';
import type { Role } from '@/lib/auth';

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  branchId: string | null;
  branchIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  nextCursor: string | null;
}

export interface AdminUsersQuery {
  role?: Role;
  active?: boolean;
  search?: string;
  branchId?: string;
  limit?: number;
  cursor?: string | null;
}

export async function fetchAdminUsers(params: AdminUsersQuery): Promise<AdminUsersResponse> {
  const resp = await api.get<AdminUsersResponse>('/admin/users', {
    params: {
      role: params.role,
      active:
        params.active === undefined ? undefined : params.active ? 'true' : 'false',
      search: params.search,
      branchId: params.branchId,
      limit: params.limit,
      cursor: params.cursor ?? undefined,
    },
  });
  return resp.data;
}

export interface CreateAdminUserInput {
  name?: string | null;
  email: string;
  role: Role;
  branchId?: string | null;
  branchIds?: string[];
  isActive?: boolean;
}

export interface CreateAdminUserResponse {
  user: AdminUser;
  tempPassword?: string;
}

export async function createAdminUser(
  input: CreateAdminUserInput,
): Promise<CreateAdminUserResponse> {
  const resp = await api.post<CreateAdminUserResponse>('/admin/users', input);
  return resp.data;
}

export interface UpdateAdminUserInput {
  id: string;
  name?: string | null;
  role?: Role;
  branchId?: string | null;
  branchIds?: string[];
  isActive?: boolean;
}

export async function updateAdminUser(input: UpdateAdminUserInput): Promise<AdminUser> {
  const { id, ...data } = input;
  const resp = await api.patch<AdminUser>(`/admin/users/${id}`, data);
  return resp.data;
}

export async function resetAdminUserPassword(userId: string): Promise<{ tempPassword: string }> {
  const resp = await api.post<{ tempPassword: string }>(`/admin/users/${userId}/reset-password`);
  return resp.data;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

/** Email of the protected admin user that cannot be deleted. */
export const PROTECTED_ADMIN_EMAIL = 'weyou@admin.com';

