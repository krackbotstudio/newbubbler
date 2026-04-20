'use client';

import { useEffect, useState } from 'react';
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

interface FiltersState {
  role: Role | 'ALL';
  activeOnly: boolean;
  search: string;
  branchId: string;
}

function useAdminUsers(filters: FiltersState) {
  const [cursor, setCursor] = useState<string | null>(null);

  const query = useQuery<AdminUsersResponse>({
    queryKey: ['admin-users', filters, cursor],
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

  return {
    query,
    cursor,
    setCursor,
  };
}

export function AdminUsersTable() {
  const [filters, setFilters] = useState<FiltersState>({
    role: 'ALL',
    activeOnly: true,
    search: '',
    branchId: '',
  });
  const [dialogUser, setDialogUser] = useState<AdminUser | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Last password shown per user (from reset or create) – session only, not persisted */
  const [lastShownPasswords, setLastShownPasswords] = useState<Record<string, string>>({});
  const [visiblePasswordUserIds, setVisiblePasswordUserIds] = useState<Record<string, true>>({});
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const { query, cursor, setCursor } = useAdminUsers(filters);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const { data: branches = [] } = useBranches();

  async function handleResetPasswordInTable(user: AdminUser) {
    setResettingUserId(user.id);
    try {
      const { tempPassword } = await resetAdminUserPassword(user.id);
      setLastShownPasswords((prev) => ({ ...prev, [user.id]: tempPassword }));
      setVisiblePasswordUserIds((prev) => ({ ...prev, [user.id]: true }));
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

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);
  const isAdmin = currentUser?.role === 'ADMIN';
  const isPartialAdmin = currentUser?.role === 'PARTIAL_ADMIN';
  const branchOptions = restrictBranchesForUser(branches, currentUser);
  const roleFilterOptions: Array<{ value: FiltersState['role']; label: string }> = isPartialAdmin
    ? [
        { value: 'ALL', label: 'All roles' },
        { value: 'OPS', label: 'Branch Head' },
        { value: 'AGENT', label: 'Agent' },
      ]
    : [
        { value: 'ALL', label: 'All roles' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'PARTIAL_ADMIN', label: 'Partial Admin' },
        { value: 'OPS', label: 'Branch Head' },
        { value: 'AGENT', label: 'Agent' },
      ];
  useEffect(() => {
    if (isPartialAdmin && filters.role !== 'ALL' && filters.role !== 'OPS' && filters.role !== 'AGENT') {
      setFilters((prev) => ({ ...prev, role: 'ALL' }));
    }
  }, [isPartialAdmin, filters.role]);
  useEffect(() => {
    if (!(isAdmin || isPartialAdmin)) return;
    if (filters.branchId) return;
    if (branchOptions.length > 0 && isPartialAdmin) {
      setFilters((prev) => ({ ...prev, branchId: branchOptions[0].id }));
    }
  }, [isAdmin, isPartialAdmin, filters.branchId, branchOptions]);
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
      <div className="relative z-10 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">Role</label>
          <Select
            value={filters.role}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, role: value as FiltersState['role'] }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              {roleFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(isAdmin || isPartialAdmin) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Branch</label>
            <Select
              value={filters.branchId || '__ALL__'}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, branchId: value === '__ALL__' ? '' : value }))
              }
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                {!isPartialAdmin && <SelectItem value="__ALL__">All branches</SelectItem>}
                {branchOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name ?? b.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Active only
          </label>
          <div className="flex items-center gap-2">
            <Switch
              checked={filters.activeOnly}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, activeOnly: checked }))
              }
            />
            <span className="text-xs text-muted-foreground">
              {filters.activeOnly ? 'Active only' : 'All'}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="Search by name or email"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <div className="flex-1" />
        {(isAdmin || isPartialAdmin) && (
          <Button
            onClick={() => {
              setDialogMode('create');
              setDialogUser(null);
              setDialogOpen(true);
            }}
          >
            New admin user
          </Button>
        )}
      </div>

      <div className="relative z-0 rounded-md border">
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
                const isPasswordVisible = !!visiblePasswordUserIds[user.id];
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
                        : user.role === 'PARTIAL_ADMIN'
                          ? 'Partial Admin'
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
                  ) : pwdState.hasValue && isPasswordVisible ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {pwdState.value}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleCopyPassword(pwdState.value)}
                        title="Copy password"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Hidden</span>
                  )}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <div className="flex justify-end gap-1.5">
                    {!isProtected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const current = lastShownPasswords[user.id];
                          if (current) {
                            setVisiblePasswordUserIds((prev) => {
                              const next = { ...prev };
                              if (next[user.id]) delete next[user.id];
                              else next[user.id] = true;
                              return next;
                            });
                            return;
                          }
                          toast.info('No visible password yet. Use Reset password to generate one.');
                        }}
                      >
                        {isPasswordVisible ? 'Hide password' : 'Show password'}
                      </Button>
                    )}
                    {!isProtected && (
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
                    {!isProtected && (
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
                    {!isProtected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          if (!window.confirm(`Delete user ${user.email ?? user.name ?? user.id}? This cannot be undone.`)) return;
                          try {
                            await deleteAdminUser(user.id);
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
            disabled={!cursor}
            onClick={() => setCursor(null)}
          >
            First page
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.nextCursor}
            onClick={() => setCursor(data?.nextCursor ?? null)}
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
          setLastShownPasswords((prev) => ({ ...prev, [userId]: password }));
          setVisiblePasswordUserIds((prev) => ({ ...prev, [userId]: true }));
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

