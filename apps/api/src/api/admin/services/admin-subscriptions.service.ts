import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceType, PaymentProvider, PaymentStatus } from '@shared/enums';
import type { InvoicesRepo, BranchRepo, SubscriptionsRepo, SubscriptionPlansRepo, CustomersRepo, BrandingRepo, OrdersRepo, PaymentsRepo } from '../../../application/ports';
import { INVOICES_REPO, BRANCH_REPO, SUBSCRIPTIONS_REPO, SUBSCRIPTION_PLANS_REPO, CUSTOMERS_REPO, BRANDING_REPO, ORDERS_REPO, PAYMENTS_REPO } from '../../../infra/infra.module';
import { getBrandingSnapshotForBranchId } from '../../../application/invoices/create-final-invoice-draft.use-case';

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    @Inject(INVOICES_REPO) private readonly invoicesRepo: InvoicesRepo,
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
    @Inject(SUBSCRIPTIONS_REPO) private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(SUBSCRIPTION_PLANS_REPO) private readonly subscriptionPlansRepo: SubscriptionPlansRepo,
    @Inject(CUSTOMERS_REPO) private readonly customersRepo: CustomersRepo,
    @Inject(BRANDING_REPO) private readonly brandingRepo: BrandingRepo,
    @Inject(ORDERS_REPO) private readonly ordersRepo: OrdersRepo,
    @Inject(PAYMENTS_REPO) private readonly paymentsRepo: PaymentsRepo,
  ) {}

  async listSubscriptionInvoices(filters: {
    customerId?: string;
    branchId?: string | null;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    cursor?: string;
  }) {
    const limit = Math.min(filters.limit ?? 20, 100);
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (filters.dateFrom) dateFrom = new Date(filters.dateFrom);
    if (filters.dateTo) {
      dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
    }
    return this.invoicesRepo.listSubscriptionInvoices({
      customerId: filters.customerId,
      branchId: filters.branchId ?? undefined,
      dateFrom,
      dateTo,
      limit,
      cursor: filters.cursor,
    });
  }

  async getSubscriptionInvoice(subscriptionId: string) {
    const invoice = await this.invoicesRepo.getBySubscriptionIdAndType(subscriptionId, InvoiceType.SUBSCRIPTION);
    if (!invoice) throw new NotFoundException('Subscription invoice not found');
    const subscription = await this.subscriptionsRepo.getById(subscriptionId);
    const plan = subscription ? await this.subscriptionPlansRepo.getById(subscription.planId) : null;
    const customer = subscription ? await this.customersRepo.getById(subscription.userId) : null;
    const branches = await this.branchRepo.listAll();
    const mainBranch = branches.find((b) => b.isDefault) ?? branches[0] ?? null;
    // All subscription bills show main branch details (branch + branding)
    const mainBranchBranding = mainBranch
      ? await getBrandingSnapshotForBranchId(mainBranch.id, { branchRepo: this.branchRepo, brandingRepo: this.brandingRepo })
      : null;
    // Branch snapshot has no termsAndConditions (Branch model); use global branding for logo + terms on subscription bills
    const globalBranding = await this.brandingRepo.get();
    const brandingSnapshotJson = mainBranchBranding
      ? {
          businessName: mainBranchBranding.businessName,
          address: mainBranchBranding.address,
          phone: mainBranchBranding.phone,
          email: mainBranchBranding.email ?? null,
          footerNote: mainBranchBranding.footerNote ?? null,
          logoUrl: (mainBranchBranding.logoUrl && mainBranchBranding.logoUrl.trim()) || (globalBranding && globalBranding.logoUrl) || null,
          upiId: mainBranchBranding.upiId ?? null,
          upiPayeeName: mainBranchBranding.upiPayeeName ?? null,
          upiQrUrl: mainBranchBranding.upiQrUrl ?? null,
          panNumber: mainBranchBranding.panNumber ?? null,
          gstNumber: mainBranchBranding.gstNumber ?? null,
          termsAndConditions: (mainBranchBranding.termsAndConditions && mainBranchBranding.termsAndConditions.trim()) || (globalBranding && globalBranding.termsAndConditions) || null,
        }
      : (invoice.brandingSnapshotJson as Record<string, unknown> | null) ?? null;
    return {
      id: invoice.id,
      subscriptionId,
      type: invoice.type,
      status: invoice.status,
      code: invoice.code,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      discountPaise: invoice.discountPaise,
      issuedAt: invoice.issuedAt,
      pdfUrl: invoice.pdfUrl,
      paymentStatus: invoice.paymentStatus,
      items: invoice.items ?? [],
      brandingSnapshotJson,
      subscriptionPurchaseSnapshotJson: (invoice as { subscriptionPurchaseSnapshotJson?: unknown }).subscriptionPurchaseSnapshotJson ?? null,
      mainBranch: mainBranch
        ? {
            name: mainBranch.name,
            address: mainBranch.address,
            phone: mainBranch.phone,
            email: mainBranch.email,
            footerNote: mainBranch.footerNote ?? null,
          }
        : null,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      planName: plan?.name ?? (invoice.items?.[0]?.name ?? null),
      planDescription: plan?.description ?? null,
    };
  }

  /** Subscription detail for admin: invoice (order ID), payment status, and all orders booked from this subscription. */
  async getSubscriptionDetail(subscriptionId: string) {
    const subscription = await this.subscriptionsRepo.getById(subscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    const invoice = await this.invoicesRepo.getBySubscriptionIdAndType(subscriptionId, InvoiceType.SUBSCRIPTION);
    if (!invoice) throw new NotFoundException('Subscription invoice not found');
    const payment = await this.paymentsRepo.getBySubscriptionId(subscriptionId);
    const plan = await this.subscriptionPlansRepo.getById(subscription.planId);
    const customer = await this.customersRepo.getById(subscription.userId);
    const orders = await this.ordersRepo.listBySubscriptionId(subscriptionId);
    return {
      subscriptionId,
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        validityStartDate: subscription.validityStartDate,
        expiryDate: subscription.expiryDate,
        active: subscription.active,
        remainingPickups: subscription.remainingPickups,
        usedKg: subscription.usedKg,
        usedItemsCount: subscription.usedItemsCount,
      },
      invoice: {
        id: invoice.id,
        code: invoice.code,
        total: invoice.total,
        paymentStatus: invoice.paymentStatus ?? 'DUE',
        issuedAt: invoice.issuedAt,
      },
      payment: payment
        ? {
            provider: payment.provider,
            status: payment.status,
            amount: payment.amount,
            updatedAt: payment.updatedAt,
          }
        : null,
      planName: plan?.name ?? null,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        pickupDate: o.pickupDate,
        timeWindow: o.timeWindow,
        serviceType: o.serviceType,
        createdAt: o.createdAt,
      })),
    };
  }

  /** Confirm subscription payment (UPI, CARD, etc.). Sets invoice payment status to PAID. */
  async confirmSubscriptionPayment(
    subscriptionId: string,
    dto: { provider: string; status: string; amountPaise: number },
  ) {
    const subscription = await this.subscriptionsRepo.getById(subscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found');
    const invoice = await this.invoicesRepo.getBySubscriptionIdAndType(subscriptionId, InvoiceType.SUBSCRIPTION);
    if (!invoice) throw new NotFoundException('Subscription invoice not found');
    await this.paymentsRepo.upsertForSubscription({
      subscriptionId,
      provider: dto.provider as PaymentProvider,
      status: dto.status as PaymentStatus,
      amount: dto.amountPaise,
    });
    await this.invoicesRepo.updateSubscriptionAndPayment(invoice.id, { paymentStatus: 'PAID' });
    return this.getSubscriptionDetail(subscriptionId);
  }
}
