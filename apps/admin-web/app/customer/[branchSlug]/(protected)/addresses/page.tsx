'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useCustomerFlowAddresses,
  useCreateCustomerFlowAddress,
  useDeleteCustomerFlowAddress,
  ADDRESS_LABELS,
  type AddressItem,
} from '@/hooks/customer-flow/use-addresses';
import { useCustomerFlowMe } from '@/hooks/customer-flow/use-me';
import { Button, buttonVariants } from '@/components/customer-flow/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { Input } from '@/components/customer-flow/ui/input';
import { Skeleton } from '@/components/customer-flow/ui/skeleton';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';
import { checkPincodeServiceability, submitAreaRequest, type ServiceabilityResult } from '@/lib/customer-flow/serviceability';
import { parseLatLngFromMapsUrl, reverseGeocodeAddress } from '@/lib/customer-flow/google-places';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';

type AddressFormState = {
  label: string;
  houseNo: string;
  streetArea: string;
  city: string;
  addressLine: string;
  pincode: string;
  googleMapUrl: string;
  isDefault: boolean;
};

const EMPTY_FORM: AddressFormState = {
  label: 'Home',
  houseNo: '',
  streetArea: '',
  city: '',
  addressLine: '',
  pincode: '',
  googleMapUrl: '',
  isDefault: false,
};

function buildAddressLine(form: AddressFormState): string {
  return [form.houseNo.trim(), form.streetArea.trim(), form.addressLine.trim(), form.city.trim()]
    .filter(Boolean)
    .join(', ');
}

export default function CustomerFlowAddressesPage() {
  const { data: addresses, isLoading, refetch } = useCustomerFlowAddresses();
  const createAddress = useCreateCustomerFlowAddress();
  const deleteAddress = useDeleteCustomerFlowAddress();
  const { data: me } = useCustomerFlowMe();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const [primary, setPrimary] = useState(getStoredPortal()?.primaryColor ?? '#8a1459');
  const [secondary, setSecondary] = useState(getStoredPortal()?.secondaryColor ?? '#f4e8f0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [checkingServiceability, setCheckingServiceability] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapResolveLoading, setMapResolveLoading] = useState(false);
  const [areaRequestSuccess, setAreaRequestSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p?.primaryColor) setPrimary(p.primaryColor);
      if (p?.secondaryColor) setSecondary(p.secondaryColor);
    });
  }, [branchSlug]);

  const cardBg = useMemo(() => secondary, [secondary]);
  const cardBorder = useMemo(() => `color-mix(in srgb, ${secondary} 78%, #d1d5db)`, [secondary]);
  const textPrimary = useMemo(() => `color-mix(in srgb, ${primary} 80%, #111827)`, [primary]);
  const textMuted = useMemo(() => `color-mix(in srgb, ${primary} 45%, #4b5563)`, [primary]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowAdd(false);
    setEditingId(null);
    setServiceability(null);
    setError(null);
    setAreaRequestSuccess(null);
  }

  function startEdit(addr: AddressItem) {
    setEditingId(addr.id);
    setShowAdd(false);
    setError(null);
    setAreaRequestSuccess(null);
    setForm({
      label: addr.label || 'Home',
      houseNo: addr.houseNo || '',
      streetArea: addr.streetArea || '',
      city: addr.city || '',
      addressLine: addr.addressLine || '',
      pincode: (addr.pincode || '').replace(/\D/g, '').slice(0, 6),
      googleMapUrl: addr.googleMapUrl || '',
      isDefault: !!addr.isDefault,
    });
  }

  async function checkServiceabilityNow(pincode: string) {
    const pc = pincode.trim().replace(/\D/g, '').slice(0, 6);
    if (pc.length !== 6) {
      setServiceability(null);
      return;
    }
    setCheckingServiceability(true);
    setServiceability(null);
    try {
      const result = await checkPincodeServiceability(pc);
      setServiceability(result);
    } catch {
      setServiceability({ pincode: pc, serviceable: false, message: 'Could not check serviceability.' });
    } finally {
      setCheckingServiceability(false);
    }
  }

  useEffect(() => {
    if (!showAdd && !editingId) return;
    void checkServiceabilityNow(form.pincode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode, showAdd, editingId]);

  async function handleResolveMapLink() {
    const url = form.googleMapUrl.trim();
    if (!url) return;
    setMapResolveLoading(true);
    setError(null);
    try {
      const coords = parseLatLngFromMapsUrl(url);
      if (!coords) {
        setError('Could not parse location from this Google Maps link.');
        return;
      }
      const result = await reverseGeocodeAddress(coords.lat, coords.lng);
      if (!result) {
        setError('Could not fetch address details from this map link.');
        return;
      }
      setForm((f) => ({
        ...f,
        addressLine: result.addressLine || f.addressLine,
        streetArea: result.area || f.streetArea,
        city: result.city || f.city,
        pincode: (result.pincode || f.pincode).replace(/\D/g, '').slice(0, 6),
      }));
    } finally {
      setMapResolveLoading(false);
    }
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAreaRequestSuccess(null);

    const houseNo = form.houseNo.trim();
    const streetArea = form.streetArea.trim();
    const city = form.city.trim();
    const pincode = form.pincode.trim().replace(/\D/g, '').slice(0, 6);
    const googleMapUrl = form.googleMapUrl.trim();
    const mergedAddressLine = buildAddressLine(form);

    if (!houseNo) return setError('Please enter House / Flat no.');
    if (!streetArea) return setError('Please enter Street & area.');
    if (!city) return setError('Please enter City.');
    if (!mergedAddressLine) return setError('Please enter full address.');
    if (pincode.length !== 6) return setError('Please enter a valid 6-digit pincode.');
    if (!serviceability?.serviceable) {
      return setError('This pincode is not serviceable. Use "Request to serve my area" below.');
    }

    const payload = {
      label: form.label.trim() || 'Home',
      addressLine: mergedAddressLine,
      pincode,
      isDefault: form.isDefault || ((addresses?.length ?? 0) === 0),
      googleMapUrl: googleMapUrl || null,
      houseNo: houseNo || null,
      streetArea: streetArea || null,
      city: city || null,
    };

    setSavingAddress(true);
    try {
      if (editingId) {
        await customerFlowApi.patch(`/addresses/${editingId}`, payload);
      } else {
        await createAddress.mutateAsync(payload);
      }
      await refetch();
      resetForm();
    } catch (err) {
      setError(getCustomerFlowApiError(err).message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleRequestArea() {
    setError(null);
    setAreaRequestSuccess(null);
    const pincode = form.pincode.trim().replace(/\D/g, '').slice(0, 6);
    const mergedAddressLine = buildAddressLine(form);
    if (pincode.length !== 6 || !mergedAddressLine) {
      setError('Enter pincode and address first.');
      return;
    }
    try {
      await submitAreaRequest({
        pincode,
        addressLine: mergedAddressLine,
        customerName: me?.user?.name ?? undefined,
        customerPhone: me?.user?.phone ?? undefined,
        customerEmail: me?.user?.email ?? undefined,
      });
      setAreaRequestSuccess("We've sent your pincode and address to our team.");
    } catch (err) {
      setError(getCustomerFlowApiError(err).message);
    }
  }

  if (isLoading || !addresses) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: '#ffffff' }}>
        <Skeleton className="mx-auto h-64 max-w-lg" style={{ backgroundColor: cardBg }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#ffffff' }}>
      <header className="mb-6 flex items-center gap-4">
        <Link href={`${base}/profile`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ? Profile
        </Link>
      </header>
      <Card className="mx-auto max-w-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <CardHeader>
          <CardTitle className="text-2xl font-bold" style={{ color: textPrimary }}>My Addresses</CardTitle>
          <CardDescription className="text-sm" style={{ color: textMuted }}>
            Add and manage your delivery addresses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {addresses.map((addr) => (
              <li key={addr.id}>
                <div className="flex items-start justify-between gap-3 rounded-lg border p-3" style={{ borderColor: cardBorder, backgroundColor: secondary }}>
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: textPrimary }}>
                      {addr.label || 'Address'}
                      {addr.isDefault ? (
                        <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: primary }}>
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm" style={{ color: textMuted }}>{addr.addressLine}</p>
                    <p className="text-sm" style={{ color: textMuted }}>Pincode: {addr.pincode}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(addr)}>Edit</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const ok = typeof window === 'undefined' ? true : window.confirm(`Delete address "${addr.label || 'Address'}"?`);
                        if (!ok) return;
                        deleteAddress.mutate(addr.id);
                      }}
                      style={{ color: '#b91c1c' }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {showAdd || !!editingId ? (
            <form onSubmit={handleSaveAddress} className="space-y-3 rounded-lg border p-4" style={{ borderColor: cardBorder, backgroundColor: secondary }}>
              <h4 className="text-base font-semibold" style={{ color: textPrimary }}>
                {editingId ? 'Edit address' : 'Add address'}
              </h4>

              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>Label</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-[var(--customer-primary,#C2185B)] focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#C2185B)]"
                  style={{ borderColor: cardBorder, backgroundColor: '#ffffff', color: textPrimary }}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                >
                  {ADDRESS_LABELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>Google Maps link (optional)</label>
                <Input
                  value={form.googleMapUrl}
                  onChange={(e) => setForm((f) => ({ ...f, googleMapUrl: e.target.value }))}
                  placeholder="Paste Google Maps link"
                  style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }}
                />
                <Button type="button" variant="outline" onClick={() => void handleResolveMapLink()} disabled={mapResolveLoading}>
                  {mapResolveLoading ? 'Resolving�' : 'Use map link to autofill'}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>House / Flat no.</label>
                <Input value={form.houseNo} onChange={(e) => setForm((f) => ({ ...f, houseNo: e.target.value }))} style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>Street & area</label>
                <Input value={form.streetArea} onChange={(e) => setForm((f) => ({ ...f, streetArea: e.target.value }))} style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>City</label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>Full address (optional; auto-filled from map)</label>
                <Input value={form.addressLine} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: textPrimary }}>Pincode (6 digits)</label>
                <Input
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  style={{ borderColor: cardBorder, backgroundColor: '#ffffff' }}
                />
              </div>

              {checkingServiceability ? <p className="text-sm" style={{ color: textMuted }}>Checking serviceability�</p> : null}
              {!checkingServiceability && serviceability ? (
                serviceability.serviceable ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: `color-mix(in srgb, ${primary} 30%, #bbf7d0)` }}>
                    <p className="text-sm font-medium text-green-700">We serve this area. You can save the address.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border p-3" style={{ borderColor: `color-mix(in srgb, ${primary} 24%, #fecaca)` }}>
                    <p className="text-sm font-medium text-red-700">Sorry, we're not serving your area yet.</p>
                    <p className="mt-1 text-sm" style={{ color: textMuted }}>
                      You can request us to add your pincode. We'll notify admin.
                    </p>
                    <Button type="button" className="mt-2" style={{ backgroundColor: primary }} onClick={() => void handleRequestArea()} disabled={savingAddress}>
                      Request to serve my area
                    </Button>
                  </div>
                )
              ) : null}

              {areaRequestSuccess ? <p className="text-sm text-green-700">{areaRequestSuccess}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex items-center gap-2">
                <input className="accent-[var(--customer-primary,#C2185B)]" type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                <label className="text-sm font-medium" style={{ color: textPrimary }}>Set as default address</label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={savingAddress} style={{ backgroundColor: primary }}>
                  {savingAddress ? 'Saving�' : editingId ? 'Update address' : 'Save address'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setShowAdd(true);
                setEditingId(null);
                setForm(EMPTY_FORM);
                setError(null);
                setAreaRequestSuccess(null);
              }}
              className="w-full"
              style={{ borderColor: cardBorder, backgroundColor: secondary, color: textPrimary }}
            >
              + Add address
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
