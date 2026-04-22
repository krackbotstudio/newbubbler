"use client";

import { useState, useEffect, useMemo } from "react";
import { getStoredUser, isBranchScopedStaff, type AuthUser, type Role } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  type AdminUser,
} from "@/lib/admin-users-api";
import { useBranches } from "@/hooks/useBranches";
import { ErrorDisplay } from "@/components/shared/ErrorDisplay";
import { toast } from "sonner";

interface AdminUserDialogProps {
  mode: "create" | "edit";
  user: AdminUser | null;
  currentUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When a password is shown (after create or reset), pass it to the parent so the table can display it */
  onPasswordShown?: (userId: string, password: string) => void;
}

export function AdminUserDialog({
  mode,
  user,
  currentUserId,
  open,
  onOpenChange,
  onPasswordShown,
}: AdminUserDialogProps) {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<Role | "">("");
  const [branchId, setBranchId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const { data: branches = [] } = useBranches();
  /** Refreshed whenever the dialog opens so role/branch locks match the signed-in user. */
  const actor = useMemo((): AuthUser | null => (open ? getStoredUser() : null), [open]);
  const isOpsEditing = actor?.role === "OPS" && mode === "edit" && !!user;

  const branchOptions = useMemo(() => {
    if (actor?.role === "OPS" && actor.branchId) {
      return branches.filter((b) => b.id === actor.branchId);
    }
    return branches;
  }, [actor, branches]);

  const allowedRoleOptions: Role[] = useMemo(() => {
    if (!actor || actor.role === "ADMIN" || actor.role === "BILLING") {
      return ["ADMIN", "OPS", "AGENT"];
    }
    if (actor.role === "OPS" && mode === "edit" && user) {
      if (user.id === actor.id) return ["OPS"];
      if (user.role === "AGENT") return ["AGENT"];
    }
    return ["ADMIN", "OPS", "AGENT"];
  }, [actor, mode, user]);

  const roleSelectLocked = isOpsEditing && allowedRoleOptions.length === 1;
  const branchSelectLocked = isOpsEditing && role !== "" && isBranchScopedStaff(role);

  useEffect(() => {
    if (open) {
      const a = getStoredUser();
      if (mode === "edit" && user) {
        setName(user.name ?? "");
        setEmail(user.email);
        setRole(user.role);
        setBranchId(a?.role === "OPS" && a.branchId ? a.branchId : user.branchId ?? "");
        setIsActive(user.isActive);
      } else {
        setName("");
        setEmail("");
        setRole("");
        setBranchId("");
        setIsActive(true);
      }
      setError(null);
      setSubmitting(false);
    }
  }, [open, mode, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a = getStoredUser();
    if (mode === "create" && a?.role === "OPS") {
      setError("Branch heads cannot create new users.");
      return;
    }
    const effectiveRole = a?.role === "OPS" && mode === "edit" && user ? (user.role as Role) : (role as Role);
    if (!effectiveRole) {
      setError("Role is required");
      return;
    }
    if (isBranchScopedStaff(effectiveRole) && !branchId && !(a?.role === "OPS" && a.branchId)) {
      setError("Branch is required for Branch Head and Agent");
      return;
    }
    if (!email) {
      setError("Email is required");
      return;
    }
    // Confirm before disabling a user.
    if (mode === "edit" && user?.isActive && !isActive) {
      const confirmed = window.confirm(
        "Are you sure you want to disable this admin user? They will no longer be able to sign in."
      );
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "create") {
        const { user: newUser, tempPassword } = await createAdminUser({
          name: name || null,
          email,
          role: role as Role,
          branchId: isBranchScopedStaff(role as Role) ? branchId || null : null,
          isActive,
        });
        if (tempPassword && newUser) {
          onPasswordShown?.(newUser.id, tempPassword);
        }
      } else if (mode === "edit" && user) {
        const r = (a?.role === "OPS" ? user.role : role) as Role;
        const branchForUpdate =
          a?.role === "OPS" && a.branchId && isBranchScopedStaff(r)
            ? a.branchId
            : isBranchScopedStaff(r)
              ? branchId || null
              : null;
        await updateAdminUser({
          id: user.id,
          name: name || null,
          role: r,
          branchId: branchForUpdate,
          isActive,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!user) return;
    const confirmed = window.confirm(
      "Generate a new password for this user? They will need this new password to sign in. Copy and share it with them."
    );
    if (!confirmed) return;
    setResettingPassword(true);
    setError(null);
    try {
      const { tempPassword } = await resetAdminUserPassword(user.id);
      onPasswordShown?.(user.id, tempPassword);
      toast.success("Password reset. Shown in table – copy and share with the user.");
    } catch (err) {
      setError(err);
    } finally {
      setResettingPassword(false);
    }
  }

  const title = mode === "create" ? "New admin user" : "Edit admin user";
  /** `role` state is `Role | ""` until selected; narrow before `isBranchScopedStaff(Role)`. */
  const branchFieldVisible = role !== "" && isBranchScopedStaff(role);
  const canManageTargetUser = true;
  const submitDisabledReason =
    submitting || !canManageTargetUser || (mode === "create" && actor?.role === "OPS");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? <ErrorDisplay error={error} /> : null}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={mode === "edit"}
            />
          </div>
          {!canManageTargetUser ? (
            <p className="text-sm text-destructive">Not allowed.</p>
          ) : null}
          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={role || ""}
              onValueChange={(value) => {
                const newRole = value as Role;
                setRole(newRole);
                if (!isBranchScopedStaff(newRole)) setBranchId("");
              }}
              disabled={roleSelectLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {allowedRoleOptions.includes("ADMIN") && <SelectItem value="ADMIN">Admin</SelectItem>}
                {allowedRoleOptions.includes("OPS") && <SelectItem value="OPS">Branch Head</SelectItem>}
                {allowedRoleOptions.includes("AGENT") && <SelectItem value="AGENT">Agent</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {branchFieldVisible && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Branch</label>
              <Select
                value={branchId || ""}
                onValueChange={setBranchId}
                required
                disabled={branchSelectLocked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch (required)" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name ?? b.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Branch Head and Agent must be assigned to one branch. They only see data for that branch.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">
                Disabled users cannot sign in to the admin.
                {user && currentUserId === user.id
                  ? " You cannot disable your own account."
                  : null}
              </div>
            </div>
            <Switch
              checked={isActive}
              disabled={!!user && currentUserId === user.id}
              onCheckedChange={setIsActive}
            />
          </div>
          {mode === "edit" && user && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-medium text-amber-900">Password</div>
              <p className="text-xs text-amber-800 mt-0.5 mb-2">
                Generate a new password and share it with this user so they can sign in.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? "Generating…" : "Reset password & copy"}
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabledReason}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

