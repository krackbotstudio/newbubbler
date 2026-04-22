'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@/lib/auth';
import {
  fetchAdminUsers,
  deleteAdminUser,
  resetAdminUserPassword,
  PROTECTED_ADMIN_EMAIL,
  type AdminUser,
  type AdminUsersResponse,
} from '@/lib/admin-users-api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getStoredUser, restrictBranchesForUser, type AuthUser } from '@/lib/auth';
import { getFriendlyErrorMessage, getApiErrorDetails } from '@/lib/api';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { AdminUserDialog } from './AdminUserDialog';
import { useBranches } from '@/hooks/useBranches';

const TEMP_PW_SESSION_KEY = 'bubbler-admin-staff-temp-passwords';

function readTempPasswordCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(TEMP_PW_SESSION_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return {};
    return o as Record<string, string>;
  } catch {
    return {};
  }
}

function writeTempPasswordCache(map: Record<string, string>) {
  try {
    sessionStorage.setItem(TEMP_PW_SESSION_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

interface FiltersState {
  role: Role | 'ALL';
  activeOnly: boolean;
  search: string;
  branchId: string;
}

function useAdminUsers(filters: FiltersState, cursor: string | null, enabled: boolean) {
  const query = useQuery<AdminUsersResponse>({
    queryKey: ['admin-users', filters, cursor],
    enabled,
    queryFn: () =>
      fetchAdminUsers({
        role: filters.role === 'ALL' ? undefined : (filters.role as Role),
        active: filters.activeOnly ? true : undefined,
        search: filters.search || undefined,
        branchId: filters.branchId || undefined,
        limit: 20,
        cursor,
      }),
  });

  return { query };
}

export function AdminUsersTable() {
  const [filters, setFilters] = useState<FiltersState>({
    role: 'ALL',
    activeOnly: true,
    search: '',
    branchId: '',
  });
  /** Kept in parent so filter changes can reset cursor in the same handler (avoids stale cursor + wrong/empty pages). */
  const [listCursor, setListCursor] = useState<string | null>(null);

  function patchFilters(patch: Partial<FiltersState>) {
    setListCursor(null);
    setFilters((prev) => ({ ...prev, ...patch }));
  }
  const [dialogUser, setDialogUser] = useState<AdminUser | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Plaintext temp passwords from create/reset only (same tab session via sessionStorage). */
  const [lastShownPasswords, setLastShownPasswords] = useState<Record<string, string>>({});
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  useEffect(() => {
    setLastShownPasswords(readTempPasswordCache());
  }, []);

  function rememberTempPassword(userId: string, password: string) {
    setLastShownPasswords((prev) => {
      const next = { ...prev, [userId]: password };
      writeTempPasswordCache(next);
      return next;
    });
  }

  function forgetTempPassword(userId: string) {
    setLastShownPasswords((prev) => {
      const next = { ...prev };
      delete next[userId];
      writeTempPasswordCache(next);
      return next;
    });
  }

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  /** Avoid listing until we know Admin vs Branch Head so filters/query stay aligned. */
  const [authHydrated, setAuthHydrated] = useState(false);
  useEffect(() => {
    setCurrentUser(getStoredUser());
    setAuthHydrated(true);
  }, []);

  const { data: branches = [] } = useBranches();

  const isAdmin = currentUser?.role === 'ADMIN';
  const isOpsBranchHead = currentUser?.role === 'OPS' && !!currentUser?.branchId;
  const branchOptions = restrictBranchesForUser(branches, currentUser);
  const roleFilterOptions: Array<{ value: FiltersState['role']; label: string }> = useMemo(() => {
    if (isOpsBranchHead) {
      return [
        { value: 'ALL', label: 'All roles' },
        { value: 'OPS', label: 'Branch Head' },
        { value: 'AGENT', label: 'Agent' },
      ];
    }
    return [
      { value: 'ALL', label: 'All roles' },
      { value: 'ADMIN', label: 'Admin' },
      { value: 'OPS', label: 'Branch Head' },
      { value: 'AGENT', label: 'Agent' },
    ];
  }, [isOpsBranchHead]);

  /** First paint used admin role options; reset invalid role before calling the API as Branch Head. */
  useEffect(() => {
    if (!authHydrated || currentUser?.role !== 'OPS') return;
    const allowed: ReadonlyArray<FiltersState['role']> = ['ALL', 'OPS', 'AGENT'];
    if (!allowed.includes(filters.role)) {
      setListCursor(null);
      setFilters((prev) => ({ ...prev, role: 'ALL' }));
    }
  }, [authHydrated, currentUser?.role, filters.role]);

  const { query } = useAdminUsers(filters, listCursor, authHydrated);

  async function handleResetPasswordInTable(user: AdminUser) {
    setResettingUserId(user.id);
    try {
      const { tempPassword } = await resetAdminUserPassword(user.id);
      rememberTempPassword(user.id, tempPassword);
      toast.success('Password reset. Copy from the table and share with the user.');
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setResettingUserId(null);
    }
  }

  function handleCopyPassword(password: string) {
    navigator.clipboard.writeText(password);
    toast.success('Password copied');
  }

  function sameBranchAsActor(user: AdminUser): boolean {
    if (!currentUser?.branchId) return false;
    return user.branchId === currentUser.branchId;
  }

  /** Branch heads may reset their own password or an agent’s; admins can reset any non-protected user. */
  function rowCanResetPassword(user: AdminUser): boolean {
    if (isAdmin) return true;
    if (!isOpsBranchHead) return false;
    if (currentUser && user.id === currentUser.id) return true;
    return user.role === 'AGENT' && sameBranchAsActor(user);
  }

  /** Branch heads edit agents only (not their own row). */
  function rowCanEdit(user: AdminUser): boolean {
    if (isAdmin) return true;
    if (!isOpsBranchHead || !sameBranchAsActor(user)) return false;
    return user.role === 'AGENT';
  }

  function rowCanDelete(_user: AdminUser): boolean {
    return isAdmin;
  }
  const data = query.data;
  const getPasswordState = (userId: string) => {
    const pwd = lastShownPasswords[userId];
    return {
      value: pwd ?? '',
      hasValue: !!pwd,
    };
  };

  return (
    <div className="space-y-4">
      <div className="relative z-50 rounded-lg border border-border/70 bg-muted/15 p-3 sm:p-4">
        <div className="flex min-w-0 flex-nowrap items-end gap-3 overflow-x-auto pb-0.5 md:overflow-visible">
          <div className="relative z-50 w-[11.5rem] shrink-0 sm:w-[12.5rem]">
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Role
            </label>
            <Select
              value={filters.role}
              onValueChange={(value) =>
                patchFilters({ role: value as FiltersState['role'] })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="max-h-72 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] border border-neutral-200 bg-white text-neutral-900 shadow-lg ring-0 dark:bg-white dark:text-neutral-900"
              >
                {roleFilterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="relative z-50 w-[12.5rem] shrink-0 sm:w-[14rem]">
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Branch
              </label>
              <Select
                value={filters.branchId || '__ALL__'}
                onValueChange={(value) =>
                  patchFilters({ branchId: value === '__ALL__' ? '' : value })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  collisionPadding={16}
                  className="max-h-72 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] border border-neutral-200 bg-white text-neutral-900 shadow-lg ring-0 dark:bg-white dark:text-neutral-900"
                >
                  <SelectItem value="__ALL__">All branches</SelectItem>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name ?? b.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="shrink-0">
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Active only
            </label>
            <div className="flex h-10 items-center gap-2">
              <Switch
                checked={filters.activeOnly}
                onCheckedChange={(checked) => patchFilters({ activeOnly: checked })}
              />
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {filters.activeOnly ? 'Active only' : 'All'}
              </span>
            </div>
          </div>
          <div className="min-w-[12rem] flex-1 basis-[min(100%,16rem)]">
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Search
            </label>
            <Input
              className="h-10 w-full min-w-0"
              placeholder="Search by name or email"
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
            />
          </div>
          {isAdmin && (
            <div className="ms-auto shrink-0">
              <Button
                className="h-10 whitespace-nowrap px-4"
                onClick={() => {
                  setDialogMode('create');
                  setDialogUser(null);
                  setDialogOpen(true);
                }}
              >
                New admin user
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-0 mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Password</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={7}>
                  Loading users...
                </td>
              </tr>
            )}
            {query.isError && !query.isLoading && (
              <tr>
                <td className="px-3 py-4 text-sm text-destructive" colSpan={7}>
                  {getFriendlyErrorMessage(query.error)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-7 gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(getApiErrorDetails(query.error));
                      toast.success('Error details copied');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </td>
              </tr>
            )}
            {!query.isLoading && data && data.data.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={7}>
                  No admin users found.
                </td>
              </tr>
            )}
            {data?.data.map((user) => (
              (() => {
                const isProtected = (user.email ?? '').trim().toLowerCase() === PROTECTED_ADMIN_EMAIL;
                const pwdState = getPasswordState(user.id);
                return (
              <tr key={user.id} className="border-t">
                <td className="px-3 py-2 align-middle">
                  <div className="font-medium">{user.name ?? '—'}</div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div>{user.email}</div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                    {user.role === 'OPS'
                      ? 'Branch Head'
                      : user.role === 'AGENT'
                        ? 'Agent'
                        : user.role}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle">
                  <span
                    className={
                      user.isActive
                        ? 'rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                        : 'rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 align-middle">
                  {isProtected ? (
                    <span className="text-xs text-muted-foreground">Protected</span>
                  ) : pwdState.hasValue ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {pwdState.value}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => handleCopyPassword(pwdState.value)}
                        title="Copy password"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Use <span className="font-medium text-foreground">Reset password</span> to generate one
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <div className="flex justify-end gap-1.5">
                    {!isProtected && rowCanResetPassword(user) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleResetPasswordInTable(user)}
                        disabled={resettingUserId === user.id}
                      >
                        {resettingUserId === user.id ? 'Resetting…' : 'Reset password'}
                      </Button>
                    )}
                    {!isProtected && rowCanEdit(user) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDialogMode('edit');
                        setDialogUser(user);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    )}
                    {!isProtected && rowCanDelete(user) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          if (!window.confirm(`Delete user ${user.email ?? user.name ?? user.id}? This cannot be undone.`)) return;
                          try {
                            await deleteAdminUser(user.id);
                            forgetTempPassword(user.id);
                            toast.success('User deleted');
                            query.refetch();
                          } catch (e) {
                            toast.error(getFriendlyErrorMessage(e));
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {data?.data.length ?? 0} user{(data?.data.length ?? 0) === 1 ? '' : 's'} on this page
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!listCursor}
            onClick={() => setListCursor(null)}
          >
            First page
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.nextCursor}
            onClick={() => setListCursor(data?.nextCursor ?? null)}
          >
            Next
          </Button>
        </div>
      </div>

      <AdminUserDialog
        mode={dialogMode}
        user={dialogUser}
        currentUserId={currentUser?.id ?? null}
        open={dialogOpen}
        onPasswordShown={(userId, password) => {
          rememberTempPassword(userId, password);
        }}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDialogUser(null);
            setDialogMode('create');
            query.refetch();
          }
        }}
      />
    </div>
  );
}

