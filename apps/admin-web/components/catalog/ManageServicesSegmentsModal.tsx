'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useUpdateServiceCategory,
  useDeleteServiceCategory,
  useUpdateSegmentCategory,
  useDeleteSegmentCategory,
} from '@/hooks/useCatalog';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import type { Role } from '@/lib/auth';
import type { ServiceCategory, SegmentCategory } from '@/types';
import { Pencil, Trash2 } from 'lucide-react';

function canMutateTaxonomyRow(role: Role, viewerBranchId: string | null | undefined, rowBranchId: string): boolean {
  if (role === 'ADMIN') return true;
  return !!viewerBranchId && rowBranchId === viewerBranchId;
}

interface ManageServicesSegmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current catalog taxonomy branch id (matrix scope). Used with commonTaxonomyBranchId for help text only. */
  taxonomyBranchId?: string;
  /** Default-branch id: segment/service rows on this branch are org-wide “common”. */
  commonTaxonomyBranchId?: string;
  role: Role;
  /** Branch head’s assigned branch; common rows use a different id and are view-only for OPS. */
  viewerBranchId?: string | null;
  segmentCategories: SegmentCategory[];
  serviceCategories: ServiceCategory[];
}

function SegmentRow({
  segment,
  commonTaxonomyBranchId,
  canMutate,
  onUpdated,
  onDeleted,
}: {
  segment: SegmentCategory;
  commonTaxonomyBranchId?: string;
  canMutate: boolean;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(segment.label);
  const updateSegment = useUpdateSegmentCategory();
  const deleteSegment = useDeleteSegmentCategory();

  const handleSave = () => {
    const trimmed = editLabel.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    updateSegment.mutate(
      { id: segment.id, label: trimmed },
      {
        onSuccess: () => {
          toast.success('Segment updated');
          setEditing(false);
          onUpdated();
        },
        onError: (err) => toast.error(getFriendlyErrorMessage(err)),
      },
    );
  };

  const handleDelete = () => {
    if (!confirm(`Delete segment "${segment.label}"? Any prices using this segment will be removed.`)) return;
    deleteSegment.mutate(segment.id, {
      onSuccess: () => {
        toast.success('Segment deleted');
        onDeleted();
      },
      onError: (err) => toast.error(getFriendlyErrorMessage(err)),
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      {editing ? (
        <>
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Segment name"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateSegment.isPending}>
            Save
          </Button>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="font-medium">{segment.label}</span>
            {commonTaxonomyBranchId && segment.branchId === commonTaxonomyBranchId ? (
              <Badge variant="secondary" className="shrink-0 font-normal">
                Common
              </Badge>
            ) : null}
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">{segment.code}</span>
          {canMutate ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(true)} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteSegment.isPending}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs" title="Only admins or this branch's own categories can be edited">
              View only
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  commonTaxonomyBranchId,
  canMutate,
  onUpdated,
  onDeleted,
}: {
  service: ServiceCategory;
  commonTaxonomyBranchId?: string;
  canMutate: boolean;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(service.label);
  const updateService = useUpdateServiceCategory();
  const deleteService = useDeleteServiceCategory();

  const handleSave = () => {
    const trimmed = editLabel.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    updateService.mutate(
      { id: service.id, label: trimmed },
      {
        onSuccess: () => {
          toast.success('Service updated');
          setEditing(false);
          onUpdated();
        },
        onError: (err) => toast.error(getFriendlyErrorMessage(err)),
      },
    );
  };

  const handleDelete = () => {
    if (!confirm(`Delete service "${service.label}"? Any prices using this service will be removed.`)) return;
    deleteService.mutate(service.id, {
      onSuccess: () => {
        toast.success('Service deleted');
        onDeleted();
      },
      onError: (err) => toast.error(getFriendlyErrorMessage(err)),
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      {editing ? (
        <>
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Service name"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateService.isPending}>
            Save
          </Button>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="font-medium">{service.label}</span>
            {commonTaxonomyBranchId && service.branchId === commonTaxonomyBranchId ? (
              <Badge variant="secondary" className="shrink-0 font-normal">
                Common
              </Badge>
            ) : null}
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">{service.code}</span>
          {canMutate ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(true)} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteService.isPending}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs" title="Only admins or this branch's own categories can be edited">
              View only
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function ManageServicesSegmentsModal({
  open,
  onOpenChange,
  taxonomyBranchId,
  commonTaxonomyBranchId,
  role,
  viewerBranchId,
  segmentCategories,
  serviceCategories,
}: ManageServicesSegmentsModalProps) {
  const mergedCommonView =
    !!commonTaxonomyBranchId &&
    !!taxonomyBranchId?.trim() &&
    taxonomyBranchId.trim() !== commonTaxonomyBranchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Services & Segments</DialogTitle>
          {mergedCommonView ? (
            <DialogDescription>
              <span className="text-muted-foreground">Common</span> is shared from the main branch; other rows are
              only for this branch.
            </DialogDescription>
          ) : commonTaxonomyBranchId ? (
            <DialogDescription>
              <span className="text-muted-foreground">Common</span> marks taxonomy on the main branch (all branches).
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Segments</h3>
            <div className="space-y-2">
              {segmentCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">No segments yet. Add them from the Edit Item modal.</p>
              ) : (
                segmentCategories.map((seg) => (
                  <SegmentRow
                    key={seg.id}
                    segment={seg}
                    commonTaxonomyBranchId={commonTaxonomyBranchId}
                    canMutate={canMutateTaxonomyRow(role, viewerBranchId, seg.branchId)}
                    onUpdated={() => {}}
                    onDeleted={() => {}}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Services</h3>
            <div className="space-y-2">
              {serviceCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">No services yet. Add them from the Edit Item modal.</p>
              ) : (
                serviceCategories.map((svc) => (
                  <ServiceRow
                    key={svc.id}
                    service={svc}
                    commonTaxonomyBranchId={commonTaxonomyBranchId}
                    canMutate={canMutateTaxonomyRow(role, viewerBranchId, svc.branchId)}
                    onUpdated={() => {}}
                    onDeleted={() => {}}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
