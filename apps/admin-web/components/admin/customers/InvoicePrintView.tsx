'use client';

import { forwardRef } from 'react';
import { formatMoney, formatDate, formatPickupDayDisplay, formatTimeWindow24h } from '@/lib/format';
import { getApiOrigin } from '@/lib/api';
import { CatalogItemIcon } from '@/components/catalog/CatalogItemIcon';
import type { OrderAdminSummary } from '@/types';
import type { CatalogMatrixResponse } from '@/types/catalog';

type InvoiceType = 'ACK' | 'FINAL';

export interface InvoicePrintViewProps {
  summary: OrderAdminSummary;
  invoice: OrderAdminSummary['invoices'][number];
  type: InvoiceType;
  branding: {
    businessName?: string | null;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    panNumber?: string | null;
    gstNumber?: string | null;
    termsAndConditions?: string | null;
  } | null;
  /** For FINAL invoice: the ack invoice (Ref block). */
  ackInvoice?: OrderAdminSummary['invoices'][number] | null;
  catalogMatrix?: CatalogMatrixResponse | null;
  /** Subscription usage row shows Qty as "X KG" or "X Nos" when set; row index when subscription applied. */
  subscriptionUnit?: 'KG' | 'Nos';
  subscriptionUsageRowIndex?: number;
  /** Appended as ?v= on logo URL (e.g. admin branding `updatedAt`) so the image is not stuck cached. */
  logoUrlCacheBuster?: string | null;
}

export const InvoicePrintView = forwardRef<HTMLDivElement, InvoicePrintViewProps>(
  function InvoicePrintView(
    {
      summary,
      invoice,
      type,
      branding,
      ackInvoice,
      catalogMatrix,
      subscriptionUnit,
      subscriptionUsageRowIndex,
      logoUrlCacheBuster,
    },
    ref
  ) {
    const { order, customer, address, branch } = summary;
    const items = invoice.items ?? [];
    const useMatrix = Boolean(catalogMatrix?.items?.length);
    const discPaise = invoice.discountPaise ?? 0;
    const taxableAfterDisc = Math.max(0, invoice.subtotal - discPaise);
    const taxPercent =
      taxableAfterDisc > 0 ? Math.round((invoice.tax / taxableAfterDisc) * 1000) / 10 : 0;

    function segmentLabel(id: string | null | undefined): string {
      if (!id || !catalogMatrix) return '—';
      return catalogMatrix.segmentCategories.find((s) => s.id === id)?.label ?? '—';
    }
    function serviceLabel(id: string | null | undefined): string {
      if (!id || !catalogMatrix) return '—';
      return catalogMatrix.serviceCategories.find((s) => s.id === id)?.label ?? '—';
    }

    function catalogItemForRow(catalogItemId: string | null | undefined) {
      if (!catalogItemId || !catalogMatrix) return undefined;
      return catalogMatrix.items.find((x) => x.id === catalogItemId);
    }

    function logoSrc(): string | null {
      const raw = branding?.logoUrl;
      if (!raw?.trim()) return null;
      const base = raw.startsWith('http') ? raw : `${getApiOrigin()}${raw}`;
      if (logoUrlCacheBuster) {
        return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(logoUrlCacheBuster)}`;
      }
      return base;
    }

    const resolvedLogo = logoSrc();

    return (
      <div ref={ref} className="bg-white text-black p-6 max-w-2xl mx-auto space-y-4 invoice-print-view">
        {/* Centered logo only (branch / business name appear in the details block below) */}
        <div className="flex border-b pb-4 items-center justify-center invoice-print-header-logo">
          <div className="flex-shrink-0 flex justify-center">
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt="Logo"
                className="h-14 w-auto max-w-[200px] object-contain"
              />
            ) : (
              <div className="h-14 w-24 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                Logo
              </div>
            )}
          </div>
        </div>

        {/* ACK: single block with code; FINAL: Invoice number (left) | Ref Acknowledgement (right) */}
        {type === 'ACK' ? (
          invoice.code && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <p className="font-medium mb-0.5">Acknowledge Invoice</p>
              <p className="text-gray-600 text-xs">{invoice.code}</p>
              {invoice.issuedAt && (
                <p className="text-gray-600 text-xs mt-0.5">
                  Issued: {formatDate(invoice.issuedAt)}
                  {invoice.issuedAt.includes('T') &&
                    ' ' + new Date(invoice.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-nowrap gap-4 items-start justify-between">
            <div className="min-w-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm flex-shrink">
              <p className="font-medium mb-0.5">Invoice number</p>
              <p className="text-gray-600 text-xs">{invoice.code ?? '—'}</p>
              {invoice.issuedAt && (
                <p className="text-gray-600 text-xs">
                  Issued: {formatDate(invoice.issuedAt)}
                  {invoice.issuedAt.includes('T') &&
                    ' ' + new Date(invoice.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            {ackInvoice && (
              <div className="text-right rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm shrink-0 min-w-0">
                <p className="font-medium mb-0.5">Ref Acknowledgement invoice</p>
                <p className="text-gray-600 text-xs leading-tight">
                  {ackInvoice.code && <span>Code: {ackInvoice.code}</span>}
                  {ackInvoice.subtotal != null && (
                    <span>{ackInvoice.code ? ' · ' : ''}Subtotal: {formatMoney(ackInvoice.subtotal)}</span>
                  )}
                </p>
                {ackInvoice.issuedAt && (
                  <p className="text-gray-600 text-xs leading-tight mt-0.5">
                    Issued: {formatDate(ackInvoice.issuedAt)}
                    {ackInvoice.issuedAt.includes('T') &&
                      ' ' +
                        new Date(ackInvoice.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Order details (left) | PAN, GST, Branch (right) */}
        <div className="flex flex-wrap gap-4 items-start rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex-1 min-w-[200px]">
            <p className="font-bold mb-1">Order details</p>
            <p>{customer.name ?? '—'}</p>
            {order.orderType === 'SUBSCRIPTION' && (
              <p className="text-gray-600">
                Subscription booking{summary.subscription?.planName ? ` (${summary.subscription.planName})` : ''}
              </p>
            )}
            <p>{address.addressLine}, {address.pincode}</p>
            <p className="text-gray-600">
              Pickup:{' '}
              {order.orderSource === 'WALK_IN'
                ? 'Walk order'
                : `${formatPickupDayDisplay(order.pickupDate)} · ${formatTimeWindow24h(order.timeWindow) || order.timeWindow}`}
            </p>
          </div>
          <div className="text-right text-gray-600 space-y-0.5">
            {branding?.businessName?.trim() ? (
              <p className="font-bold text-gray-900 mb-1">{branding.businessName.trim()}</p>
            ) : null}
            {branding?.panNumber && <p>PAN: {branding.panNumber}</p>}
            {branding?.gstNumber && <p>GST: {branding.gstNumber}</p>}
            {branch && (
              <>
                <p className="font-medium text-gray-900">{branch.name}</p>
                <p>{branch.address}</p>
              </>
            )}
          </div>
        </div>

        {/* Subscription utilised (green box) */}
        {summary.subscriptionUsage && summary.subscription && (
          <div className="rounded-md border border-green-200 bg-green-50 p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-green-700 font-medium" aria-hidden>✓</span>
              <span className="text-green-800 font-medium">{summary.subscription.planName}</span>
              <span className="text-green-800">
                {summary.subscription.remainingPickups}/{summary.subscription.maxPickups} pickups left
                {summary.subscription.kgLimit != null &&
                  ` · ${Number(summary.subscription.usedKg ?? 0)}/${summary.subscription.kgLimit} kg`}
                {summary.subscription.itemsLimit != null &&
                  ` · ${summary.subscription.usedItemsCount ?? 0}/${summary.subscription.itemsLimit} items`}
                {' · Applied'}
              </span>
            </div>
          </div>
        )}

        {/* Line items table */}
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {useMatrix ? (
                  <>
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Segment</th>
                    <th className="text-left py-2">Service</th>
                  </>
                ) : (
                  <>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Name</th>
                  </>
                )}
                <th className="text-right py-2">Qty</th>
                {useMatrix ? (
                  <>
                    <th className="text-right py-2">Service cost (₹)</th>
                    <th className="text-right py-2">Total cost (₹)</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2">Unit (₹)</th>
                    <th className="text-right py-2">Amount (₹)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className="border-b">
                  <td
                    colSpan={useMatrix ? 6 : 5}
                    className="py-3 text-center text-gray-500"
                  >
                    NA
                  </td>
                </tr>
              ) : (
                items.map((row, i) => {
                  const isSubUsageRow = subscriptionUsageRowIndex === i && subscriptionUnit;
                  const qtyDisplay = isSubUsageRow
                    ? `${row.quantity} ${subscriptionUnit}`
                    : String(row.quantity);
                  const catItem = catalogItemForRow(row.catalogItemId ?? undefined);
                  return (
                    <tr key={i} className="border-b border-gray-200">
                      {useMatrix ? (
                        <>
                          <td className="align-middle py-2.5">
                            <div className="flex min-h-[24px] w-full items-center gap-2.5">
                              {catItem ? (
                                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center text-gray-700 [&_svg]:block">
                                  <CatalogItemIcon
                                    icon={catItem.icon}
                                    size={18}
                                    className="shrink-0"
                                    cacheBuster={catItem.updatedAt}
                                  />
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-sm leading-6 text-gray-900">
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td className="align-middle py-2.5">{segmentLabel(row.segmentCategoryId)}</td>
                          <td className="align-middle py-2.5">{serviceLabel(row.serviceCategoryId)}</td>
                        </>
                      ) : (
                        <>
                          <td className="align-middle py-2.5">{row.type}</td>
                          <td className="align-middle py-2.5">
                            <div className="flex min-h-[24px] w-full items-center gap-2.5">
                              {catItem ? (
                                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center text-gray-700 [&_svg]:block">
                                  <CatalogItemIcon
                                    icon={catItem.icon}
                                    size={18}
                                    className="shrink-0"
                                    cacheBuster={catItem.updatedAt}
                                  />
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-sm leading-6 text-gray-900">
                                {row.name}
                              </span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="align-middle py-2.5 text-right">{qtyDisplay}</td>
                      {useMatrix ? (
                        <>
                          <td className="align-middle py-2.5 text-right">{formatMoney(row.unitPrice)}</td>
                          <td className="align-middle py-2.5 text-right">{formatMoney(row.amount)}</td>
                        </>
                      ) : (
                        <>
                          <td className="align-middle py-2.5 text-right">{formatMoney(row.unitPrice)}</td>
                          <td className="align-middle py-2.5 text-right">{formatMoney(row.amount)}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t space-y-1 text-right">
          <p className="text-base">
            Subtotal: {formatMoney(invoice.subtotal)}
            {invoice.discountPaise != null && invoice.discountPaise > 0 && (
              <> · Discount (₹): -{formatMoney(invoice.discountPaise)}</>
            )}
            {taxPercent > 0 && (
              <> · Tax ({taxPercent}%): {formatMoney(invoice.tax)}</>
            )}
          </p>
          <p className="text-2xl font-bold">
            {(() => {
              const subscriptionBased =
                invoice.orderMode === 'SUBSCRIPTION_ONLY' ||
                invoice.orderMode === 'BOTH' ||
                order.orderType === 'SUBSCRIPTION' ||
                order.orderType === 'BOTH';
              return invoice.total <= 0 && subscriptionBased
                ? 'Prepaid'
                : `Total: ${formatMoney(invoice.total)}`;
            })()}
          </p>
        </div>

        {/* Comments */}
        {invoice.comments && (
          <p className="text-sm text-gray-600 pt-2 border-t">{invoice.comments}</p>
        )}

        {/* Terms and Conditions */}
        {branding?.termsAndConditions?.trim() && (
          <div className="mt-4 pt-4 border-t text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">Terms and Conditions</p>
            <div className="whitespace-pre-line">{branding.termsAndConditions.trim()}</div>
          </div>
        )}

        {/* Footer: branch footer note (admin → branch branding); else contact line */}
        <div className="mt-6 pt-4 text-center text-sm text-gray-600 space-y-1">
          {branch?.footerNote?.trim() ? (
            <p className="whitespace-pre-line">{branch.footerNote.trim()}</p>
          ) : (
            <p>
              {[
                branch?.address ?? branding?.address ?? '',
                branding?.email ?? '',
                branch?.phone ?? branding?.phone ?? '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    );
  }
);
