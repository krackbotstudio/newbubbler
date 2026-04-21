import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InvoiceDraftBody, InvoiceDraftResponse, InvoiceIssueResponse } from '@/types';

async function createAckDraft(orderId: string, body: InvoiceDraftBody): Promise<InvoiceDraftResponse> {
  const { data } = await api.post<InvoiceDraftResponse>(`/admin/orders/${orderId}/ack-invoice/draft`, body);
  return data;
}

async function issueAck(orderId: string): Promise<InvoiceIssueResponse> {
  const { data } = await api.post<InvoiceIssueResponse>(`/admin/orders/${orderId}/ack-invoice/issue`, {});
  return data;
}

async function createFinalDraft(orderId: string, body: InvoiceDraftBody): Promise<InvoiceDraftResponse> {
  const { data } = await api.post<InvoiceDraftResponse>(`/admin/orders/${orderId}/final-invoice/draft`, body);
  return data;
}

async function issueFinal(orderId: string): Promise<InvoiceIssueResponse> {
  const { data } = await api.post<InvoiceIssueResponse>(`/admin/orders/${orderId}/final-invoice/issue`);
  return data;
}

export type RegeneratePdfResponse = { ack?: { pdfUrl: string }; final?: { pdfUrl: string } };

async function regenerateInvoicePdf(
  orderId: string,
  type?: 'ACK' | 'FINAL',
): Promise<RegeneratePdfResponse> {
  const { data } = await api.post<RegeneratePdfResponse>(`/admin/orders/${orderId}/regenerate-pdf`, type ? { type } : {});
  return data;
}

export function useCreateAckDraft(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InvoiceDraftBody) => createAckDraft(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
    },
  });
}

export function useIssueAck(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => issueAck(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
    },
  });
}

export function useCreateFinalDraft(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InvoiceDraftBody) => createFinalDraft(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
    },
  });
}

export function useIssueFinal(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => issueFinal(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
    },
  });
}

export function useRegenerateInvoicePdf(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type?: 'ACK' | 'FINAL') => regenerateInvoicePdf(orderId, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
    },
  });
}
