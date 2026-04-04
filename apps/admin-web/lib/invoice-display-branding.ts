import type { InvoiceBrandingSnapshot } from '@/types/order';

/** Live admin branding (or similar) merged with per-invoice snapshot for display. */
export type LiveBrandingForInvoiceMerge = Partial<
  Pick<
    InvoiceBrandingSnapshot,
    'businessName' | 'logoUrl' | 'address' | 'phone' | 'email' | 'panNumber' | 'gstNumber' | 'termsAndConditions'
  >
> & { updatedAt?: string | null };

function nonempty(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Merge invoice snapshot with live branding. Branch snapshots often omit `logoUrl`; fall back to global
 * branding so the logo still loads in print/dialog views.
 */
export function mergeInvoiceDisplayBranding(
  snapshot: InvoiceBrandingSnapshot | null | undefined,
  live: LiveBrandingForInvoiceMerge | null | undefined,
): {
  businessName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  termsAndConditions?: string | null;
  /** Use as ?v= on logo when URL comes from live fallback (or always safe to pass live updatedAt). */
  logoUrlCacheBuster?: string | null;
} | null {
  const snap =
    snapshot && typeof snapshot === 'object' ? (snapshot as InvoiceBrandingSnapshot) : null;
  const l = live ?? null;
  if (!snap && !l) return null;

  const logoFromSnap = snap != null && nonempty(snap.logoUrl);
  const logoUrl = logoFromSnap
    ? snap!.logoUrl!.trim()
    : nonempty(l?.logoUrl)
      ? l!.logoUrl!.trim()
      : null;

  const snapTerms = snap?.termsAndConditions?.trim();
  const termsAndConditions = snapTerms ? snap!.termsAndConditions : l?.termsAndConditions ?? null;

  return {
    businessName: nonempty(snap?.businessName) ? snap!.businessName!.trim() : l?.businessName ?? null,
    logoUrl,
    address: nonempty(snap?.address) ? snap!.address!.trim() : l?.address ?? null,
    phone: nonempty(snap?.phone) ? snap!.phone!.trim() : l?.phone ?? null,
    email: snap?.email !== undefined && snap.email !== null ? snap.email : l?.email ?? null,
    panNumber: nonempty(snap?.panNumber) ? snap!.panNumber!.trim() : l?.panNumber ?? null,
    gstNumber: nonempty(snap?.gstNumber) ? snap!.gstNumber!.trim() : l?.gstNumber ?? null,
    termsAndConditions: termsAndConditions ?? null,
    logoUrlCacheBuster: logoFromSnap ? null : (l?.updatedAt ?? null),
  };
}
