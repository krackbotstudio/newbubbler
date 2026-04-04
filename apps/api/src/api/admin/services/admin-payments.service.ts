import { Inject, Injectable } from '@nestjs/common';
import { InvoiceType } from '@shared/enums';
import { updatePaymentStatus } from '../../../application/payments/update-payment-status.use-case';
import { fulfillNewSubscriptionsFromAckInvoice } from '../../../application/invoices/fulfill-new-subscriptions-from-ack.use-case';
import type { PaymentProvider, PaymentStatus } from '@shared/enums';
import type { OrdersRepo, PaymentsRepo, UnitOfWork, InvoicesRepo, SubscriptionsRepo, SubscriptionPlansRepo } from '../../../application/ports';
import { ORDERS_REPO, PAYMENTS_REPO, UNIT_OF_WORK, INVOICES_REPO, SUBSCRIPTIONS_REPO, SUBSCRIPTION_PLANS_REPO } from '../../../infra/infra.module';

@Injectable()
export class AdminPaymentsService {
  constructor(
    @Inject(ORDERS_REPO) private readonly ordersRepo: OrdersRepo,
    @Inject(PAYMENTS_REPO) private readonly paymentsRepo: PaymentsRepo,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(INVOICES_REPO) private readonly invoicesRepo: InvoicesRepo,
    @Inject(SUBSCRIPTIONS_REPO) private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(SUBSCRIPTION_PLANS_REPO) private readonly subscriptionPlansRepo: SubscriptionPlansRepo,
  ) {}

  async updateStatus(
    orderId: string,
    dto: { provider: PaymentProvider; status: PaymentStatus; amountPaise: number; note?: string },
  ) {
    const result = await updatePaymentStatus(
      {
        orderId,
        provider: dto.provider,
        status: dto.status,
        amount: dto.amountPaise,
        failureReason: dto.note ?? null,
      },
      {
        ordersRepo: this.ordersRepo,
        paymentsRepo: this.paymentsRepo,
        unitOfWork: this.unitOfWork,
      },
    );
    if (dto.status === 'CAPTURED') {
      const order = await this.ordersRepo.getById(orderId);
      if (order && order.status !== 'CANCELLED' && order.status !== 'DELIVERED') {
        await this.ordersRepo.updateStatus(orderId, 'DELIVERED');
      }
      await fulfillNewSubscriptionsFromAckInvoice(orderId, {
        ordersRepo: this.ordersRepo,
        invoicesRepo: this.invoicesRepo,
        subscriptionsRepo: this.subscriptionsRepo,
        subscriptionPlansRepo: this.subscriptionPlansRepo,
        paymentsRepo: this.paymentsRepo,
      });
      const finalInvoice = await this.invoicesRepo.getByOrderIdAndType(orderId, InvoiceType.FINAL);
      if (finalInvoice) {
        await this.invoicesRepo.updateSubscriptionAndPayment(finalInvoice.id, { paymentStatus: 'PAID' });
      }
    }
    return result;
  }
}
