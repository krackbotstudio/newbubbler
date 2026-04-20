'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { getFriendlyErrorMessage } from '@/lib/api';
import { isoToLocalDateKey, getTodayLocalDateKey } from '@/lib/format';
import { useBranches } from '@/hooks/useBranches';
import { getStoredUser, isBranchScopedStaff, restrictBranchesForUser } from '@/lib/auth';

interface OperatingHours {
  id: string;
  branchId: string | null;
  startTime: string;
  endTime: string;
}

interface Holiday {
  id: string;
  date: string;
  label: string | null;
  branchId: string | null;
}

export default function SchedulePage() {
  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const isAdmin = user?.role === 'ADMIN';
  const isPartialAdmin = user?.role === 'PARTIAL_ADMIN';
  const isBranchHead = user && isBranchScopedStaff(user.role) && !!user.branchId;
  /** Branch heads (OPS) may set hours and branch-only holidays for their branch; agents do not (route is OPS/ADMIN). */
  const isOpsBranchHead = user?.role === 'OPS' && !!user.branchId;
  const canManageBranchSchedule = isAdmin || isOpsBranchHead;

  const { data: branches = [] } = useBranches();
  const branchOptions = useMemo(() => restrictBranchesForUser(branches, user), [branches, user]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    isBranchHead && user?.branchId ? user.branchId : '',
  );
  const [hours, setHours] = useState<OperatingHours | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursError, setHoursError] = useState<unknown>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayScopeCommon, setHolidayScopeCommon] = useState(true);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysError, setHolidaysError] = useState<unknown>(null);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editScopeCommon, setEditScopeCommon] = useState(true);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const branchIdForApi = selectedBranchId || (branchOptions.length > 0 ? branchOptions[0].id : null) || null;

  const { commonHolidays, branchHolidays } = useMemo(() => {
    const common = holidays.filter((h) => h.branchId == null);
    const branch = holidays.filter((h) => h.branchId != null);
    return { commonHolidays: common, branchHolidays: branch };
  }, [holidays]);

  useEffect(() => {
    if (isBranchHead && user?.branchId) {
      setSelectedBranchId(user.branchId);
    }
  }, [isBranchHead, user?.branchId]);

  useEffect(() => {
    if (branchOptions.length > 0) setSelectedBranchId((prev) => prev || branchOptions[0].id);
  }, [branchOptions]);

  useEffect(() => {
    if (!branchIdForApi) {
      setHoursLoading(false);
      setHoursError(null);
      setHours(null);
      setStartTime('09:00');
      setEndTime('18:00');
      return;
    }
    setHoursLoading(true);
    setHoursError(null);
    api
      .get<OperatingHours | null>('/admin/operating-hours', { params: { branchId: branchIdForApi } })
      .then((r) => {
        const h = r.data;
        setHours(h);
        if (h) {
          setStartTime(h.startTime);
          setEndTime(h.endTime);
        } else {
          setStartTime('09:00');
          setEndTime('18:00');
        }
      })
      .catch(setHoursError)
      .finally(() => setHoursLoading(false));
  }, [branchIdForApi]);

  const loadHolidays = () => {
    if (!branchIdForApi) {
      setHolidaysLoading(false);
      setHolidays([]);
      setHolidaysError(null);
      return;
    }
    const from = new Date();
    const to = new Date();
    to.setFullYear(to.getFullYear() + 1);
    const fromStr = getTodayLocalDateKey();
    const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
    setHolidaysLoading(true);
    api
      .get<Holiday[]>('/admin/holidays', { params: { from: fromStr, to: toStr, branchId: branchIdForApi } })
      .then((r) => setHolidays(r.data))
      .catch(setHolidaysError)
      .finally(() => setHolidaysLoading(false));
  };

  useEffect(() => {
    loadHolidays();
  }, [branchIdForApi]);

  useEffect(() => {
    if (isOpsBranchHead) {
      setHolidayScopeCommon(false);
    }
  }, [isOpsBranchHead]);

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setHoursSaving(true);
    setHoursError(null);
    try {
      const res = await api.put<OperatingHours>('/admin/operating-hours', {
        branchId: branchIdForApi,
        startTime,
        endTime,
      });
      setHours(res.data);
      toast.success('Operating hours saved for this branch.');
    } catch (err) {
      setHoursError(err);
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setHoursSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate.trim()) {
      toast.error('Pick a date');
      return;
    }
    setAddingHoliday(true);
    setHolidaysError(null);
    const body: { date: string; label?: string; branchId?: string | null } = {
      date: holidayDate,
      label: holidayLabel || undefined,
    };
    if (isOpsBranchHead && user?.branchId) {
      body.branchId = user.branchId;
    } else if (holidayScopeCommon) {
      body.branchId = null;
    } else if (selectedBranchId) {
      body.branchId = selectedBranchId;
    }
    try {
      await api.post('/admin/holidays', body);
      setHolidayDate('');
      setHolidayLabel('');
      setHolidaysError(null);
      loadHolidays();
      toast.success(
        isOpsBranchHead ? 'Branch holiday added.' : holidayScopeCommon ? 'Common holiday added (all branches).' : 'Branch holiday added.',
      );
    } catch (err) {
      setHolidaysError(err);
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleRemoveHoliday = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/holidays/${id}`);
      loadHolidays();
      toast.success('Holiday removed');
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const openEditHoliday = (h: Holiday) => {
    setEditingHoliday(h);
    setEditDate(isoToLocalDateKey(h.date) ?? h.date.slice(0, 10));
    setEditLabel(h.label ?? '');
    setEditScopeCommon(h.branchId == null);
  };

  const handleSaveEditHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;
    if (!editDate.trim()) {
      toast.error('Pick a date');
      return;
    }
    setSavingEditId(editingHoliday.id);
    const body: { date?: string; label?: string; branchId?: string | null } = {
      date: editDate,
      label: editLabel || undefined,
    };
    if (isOpsBranchHead && user?.branchId) {
      body.branchId = user.branchId;
    } else if (editScopeCommon) {
      body.branchId = null;
    } else if (selectedBranchId) {
      body.branchId = selectedBranchId;
    }
    try {
      await api.patch(`/admin/holidays/${editingHoliday.id}`, body);
      setEditingHoliday(null);
      loadHolidays();
      toast.success('Holiday updated');
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSavingEditId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Schedule &amp; calendar</h1>
      <p className="text-sm text-muted-foreground">
        Each branch has its own operating hours and holidays. Common holidays apply to all branches.
      </p>
      {(isAdmin || isPartialAdmin) && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Branch filter</label>
            <select
              className="h-10 min-w-[180px]"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              title="Filter schedule by branch"
            >
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {canManageBranchSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>Edit operating hours</CardTitle>
            <CardDescription>
              Daily open/close for this branch. Pickup time windows must fall within this range.
              {isAdmin ? ' Admins can edit any branch.' : ' You can edit only your branch.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hoursError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 mb-4">
                <ErrorDisplay error={hoursError} />
              </div>
            ) : null}
            {hoursLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <form onSubmit={handleSaveHours} className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start time</label>
                  <Input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:00"
                    className="w-28"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End time</label>
                  <Input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="18:00"
                    className="w-28"
                  />
                </div>
                <Button type="submit" disabled={hoursSaving}>
                  {hoursSaving ? 'Saving…' : 'Save hours'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Holidays (calendar)</CardTitle>
          <CardDescription>
            Common holidays apply to all branches. Branch-specific holidays apply only to the selected branch. Shown for the selected branch above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageBranchSchedule && (
            <form onSubmit={handleAddHoliday} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Label (optional)</label>
                <Input
                  type="text"
                  value={holidayLabel}
                  onChange={(e) => setHolidayLabel(e.target.value)}
                  placeholder="e.g. Diwali"
                />
              </div>
              {branches.length > 0 && isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={holidayScopeCommon}
                      onChange={() => setHolidayScopeCommon(true)}
                      className="rounded border-input"
                    />
                    Common (all branches)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!holidayScopeCommon}
                      onChange={() => setHolidayScopeCommon(false)}
                      className="rounded border-input"
                    />
                    This branch only
                  </label>
                </div>
              )}
              {isOpsBranchHead && (
                <p className="text-xs text-muted-foreground w-full sm:w-auto">
                  Holiday applies to <span className="font-medium text-foreground">your branch only</span>.
                </p>
              )}
              <Button type="submit" disabled={addingHoliday}>
                {addingHoliday ? 'Adding…' : 'Add holiday'}
              </Button>
            </form>
          )}
          {holidaysError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <ErrorDisplay error={holidaysError} />
              <p className="mt-2 text-xs text-muted-foreground">
                If the error mentions a missing table or relation, run the database migration from the api app: <code className="rounded bg-muted px-1">npx prisma migrate deploy --schema=src/infra/prisma/schema.prisma</code>
              </p>
            </div>
          ) : null}
          {holidaysLoading ? (
            <p className="text-sm text-muted-foreground">Loading holidays…</p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No holidays in the next year.</p>
          ) : (
            <div className="space-y-4">
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Common holidays (all branches)</h3>
                {commonHolidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {commonHolidays.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>
                          {new Date(h.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          {h.label ? ` — ${h.label}` : ''}
                        </span>
                        {isAdmin && (
                          <span className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEditHoliday(h)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === h.id}
                              onClick={() => handleRemoveHoliday(h.id)}
                            >
                              {deletingId === h.id ? 'Removing…' : 'Remove'}
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Branch-specific holidays</h3>
                {branchHolidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None for this branch.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {branchHolidays.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>
                          {new Date(h.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          {h.label ? ` — ${h.label}` : ''}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({branchOptions.find((b) => b.id === h.branchId)?.name ?? 'Branch'})
                          </span>
                        </span>
                        {(isAdmin || (isOpsBranchHead && user?.branchId === h.branchId)) && (
                          <span className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEditHoliday(h)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === h.id}
                              onClick={() => handleRemoveHoliday(h.id)}
                            >
                              {deletingId === h.id ? 'Removing…' : 'Remove'}
                            </Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingHoliday} onOpenChange={(open) => !open && setEditingHoliday(null)}>
        <DialogContent>
          <form onSubmit={handleSaveEditHoliday}>
            <DialogHeader>
              <DialogTitle>Edit holiday</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Label (optional)</label>
                <Input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Diwali"
                />
              </div>
              {branches.length > 0 && isAdmin && (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={editScopeCommon}
                      onChange={() => setEditScopeCommon(true)}
                      className="rounded border-input"
                    />
                    Common (all branches)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!editScopeCommon}
                      onChange={() => setEditScopeCommon(false)}
                      disabled={!selectedBranchId}
                      className="rounded border-input"
                    />
                    This branch only
                  </label>
                  {!selectedBranchId && (
                    <span className="text-xs text-muted-foreground">Select a branch in the dropdown above to set branch-only.</span>
                  )}
                </div>
              )}
              {isOpsBranchHead && editingHoliday?.branchId != null && (
                <p className="text-xs text-muted-foreground">
                  Saving keeps this holiday on <span className="font-medium text-foreground">your branch</span> only.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingHoliday(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!!savingEditId}>
                {savingEditId ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
