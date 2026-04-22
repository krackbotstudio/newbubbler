import { Inject, Injectable } from '@nestjs/common';
import { InvoiceType } from '@shared/enums';
import { AppError } from '../../../application/errors';
import { createAckInvoiceDraft } from '../../../application/invoices/create-ack-invoice-draft.use-case';
import { createFinalInvoiceDraft } from '../../../application/invoices/create-final-invoice-draft.use-case';
import { generateAndStoreInvoicePdf } from '../../../application/invoices/generate-and-store-invoice-pdf.use-case';
import { issueAckInvoice } from '../../../application/invoices/issue-ack-invoice-use-case';
import { issueFinalInvoice } from '../../../application/invoices/issue-final-invoice-use-case';
import type { OrdersRepo, InvoicesRepo, BrandingRepo, BranchRepo, ServiceAreaRepo, CustomersRepo, PdfGenerator, StorageAdapter, PaymentsRepo } from '../../../application/ports';
import { ORDERS_REPO, INVOICES_REPO, BRANDING_REPO, BRANCH_REPO, SERVICE_AREA_REPO, CUSTOMERS_REPO, PDF_GENERATOR, STORAGE_ADAPTER, PAYMENTS_REPO } from '../../../infra/infra.module';

@Injectable()
export class AdminInvoicesService {
  constructor(
    @Inject(ORDERS_REPO) private readonly ordersRepo: OrdersRepo,
    @Inject(INVOICES_REPO) private readonly invoicesRepo: InvoicesRepo,
    @Inject(BRANDING_REPO) private readonly brandingRepo: BrandingRepo,
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
    @Inject(SERVICE_AREA_REPO) private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(CUSTOMERS_REPO) private readonly customersRepo: CustomersRepo,
    @Inject(PDF_GENERATOR) private readonly pdfGenerator: PdfGenerator,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
    @Inject(PAYMENTS_REPO) private readonly paymentsRepo: PaymentsRepo,
  ) {}

  async createAckDraft(
    orderId: string,
    dto: {
      orderMode?: 'INDIVIDUAL';
      items: Array<{
        type: string;
        name: string;
        quantity: number;
        unitPricePaise: number;
        amountPaise?: number;
        clothesCount?: number;
        remarks?: string | null;
        catalogItemId?: string | null;
        segmentCategoryId?: string | null;
        serviceCategoryId?: string | null;
      }>;
      taxPaise?: number;
      discountPaise?: number;
      comments?: string | null;
    },
  ) {
    const items = dto.items.map((i) => ({
      type: i.type,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPricePaise,
      amount: i.amountPaise,
      ...(i.clothesCount != null && Number.isFinite(i.clothesCount) && { clothesCount: i.clothesCount }),
      ...(i.remarks != null && String(i.remarks).trim() !== '' && { remarks: String(i.remarks).trim() }),
      catalogItemId: i.catalogItemId,
      segmentCategoryId: i.segmentCategoryId,
      serviceCategoryId: i.serviceCategoryId,
    }));
    return createAckInvoiceDraft(
      {
        orderId,
        orderMode: dto.orderMode,
        items,
        tax: dto.taxPaise ?? 0,
        discountPaise: dto.discountPaise ?? null,
        comments: dto.comments,
      },
      {
        ordersRepo: this.ordersRepo,
        invoicesRepo: this.invoicesRepo,
        brandingRepo: this.brandingRepo,
        branchRepo: this.branchRepo,
        serviceAreaRepo: this.serviceAreaRepo,
      },
    );
  }

  async createFinalDraft(
    orderId: string,
    dto: {
      items: Array<{
        type: string;
        name: string;
        quantity: number;
        unitPricePaise: number;
        amountPaise?: number;
        clothesCount?: number;
        remarks?: string | null;
        catalogItemId?: string | null;
        segmentCategoryId?: string | null;
        serviceCategoryId?: string | null;
      }>;
      taxPaise?: number;
      discountPaise?: number;
      comments?: string | null;
    },
  ) {
    const items = dto.items.map((i) => ({
      type: i.type,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPricePaise,
      amount: i.amountPaise,
      ...(i.clothesCount != null && Number.isFinite(i.clothesCount) && { clothesCount: i.clothesCount }),
      ...(i.remarks != null && String(i.remarks).trim() !== '' && { remarks: String(i.remarks).trim() }),
      catalogItemId: i.catalogItemId,
      segmentCategoryId: i.segmentCategoryId,
      serviceCategoryId: i.serviceCategoryId,
    }));
    return createFinalInvoiceDraft(
      {
        orderId,
        items,
        tax: dto.taxPaise ?? 0,
        discountPaise: dto.discountPaise ?? null,
        comments: dto.comments,
      },
      {
        ordersRepo: this.ordersRepo,
        invoicesRepo: this.invoicesRepo,
        brandingRepo: this.brandingRepo,
        branchRepo: this.branchRepo,
        serviceAreaRepo: this.serviceAreaRepo,
      },
    );
  }

  async issueAck(
    orderId: string,
    options?: { applySubscription?: boolean; weightKg?: number; itemsCount?: number },
  ) {
    const result = await issueAckInvoice(
      orderId,
      {
        ordersRepo: this.ordersRepo,
        invoicesRepo: this.invoicesRepo,
        customersRepo: this.customersRepo,
        brandingRepo: this.brandingRepo,
        pdfGenerator: this.pdfGenerator,
        storageAdapter: this.storageAdapter,
        paymentsRepo: this.paymentsRepo,
      },
      options,
    );
    return { invoiceId: result.invoiceId, pdfUrl: result.pdfUrl, status: 'ISSUED' };
  }

  async issueFinal(orderId: string) {
    const result = await issueFinalInvoice(orderId, {
      ordersRepo: this.ordersRepo,
      invoicesRepo: this.invoicesRepo,
      customersRepo: this.customersRepo,
      brandingRepo: this.brandingRepo,
      pdfGenerator: this.pdfGenerator,
      storageAdapter: this.storageAdapter,
    });
    return { invoiceId: result.invoiceId, pdfUrl: result.pdfUrl, status: 'ISSUED' };
  }

  /**
   * Regenerate stored PDF for an issued invoice (e.g. after fixing PDF generator).
   * type: 'ACK' = acknowledgement only, 'FINAL' = final only, omit = both issued invoices.
   */
  async regeneratePdf(
    orderId: string,
    type?: 'ACK' | 'FINAL',
  ): Promise<{ ack?: { pdfUrl: string }; final?: { pdfUrl: string } }> {
    const deps = {
      invoicesRepo: this.invoicesRepo,
      ordersRepo: this.ordersRepo,
      customersRepo: this.customersRepo,
      brandingRepo: this.brandingRepo,
      branchRepo: this.branchRepo,
      pdfGenerator: this.pdfGenerator,
      storageAdapter: this.storageAdapter,
    };
    const result: { ack?: { pdfUrl: string }; final?: { pdfUrl: string } } = {};

    if (type === 'ACK' || type === undefined) {
      const ack = await this.invoicesRepo.getByOrderIdAndType(orderId, InvoiceType.ACKNOWLEDGEMENT);
      if (ack?.status === 'ISSUED' && ack.issuedAt) {
        const { pdfUrl } = await generateAndStoreInvoicePdf(ack.id, deps);
        result.ack = { pdfUrl };
      }
    }
    if (type === 'FINAL' || type === undefined) {
      const finalInv = await this.invoicesRepo.getByOrderIdAndType(orderId, InvoiceType.FINAL);
      if (finalInv?.status === 'ISSUED' && finalInv.issuedAt) {
        const { pdfUrl } = await generateAndStoreInvoicePdf(finalInv.id, deps);
        result.final = { pdfUrl };
      }
    }

    if (!result.ack && !result.final) {
      throw new AppError(
        'INVOICE_NOT_FOUND',
        type ? `No issued ${type} invoice found for this order` : 'No issued invoices found for this order',
        { orderId, type },
      );
    }
    return result;
  }
}
