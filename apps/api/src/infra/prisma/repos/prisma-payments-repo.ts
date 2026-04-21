import type { PrismaClient } from '@prisma/client';
import type {
  PaymentRecord,
  PaymentsRepo,
  UpsertPaymentInput,
  UpsertSubscriptionPaymentInput,
} from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'payment'>;

function toPaymentRecord(row: {
  id: string;
  orderId: string | null;
  subscriptionId?: string | null;
  provider: string;
  status: string;
  amount: number;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    subscriptionId: row.subscriptionId ?? null,
    provider: row.provider as PaymentRecord['provider'],
    status: row.status as PaymentRecord['status'],
    amount: row.amount,
    providerPaymentId: row.providerPaymentId,
    providerOrderId: row.providerOrderId,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPaymentsRepo implements PaymentsRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async upsertForOrder(input: UpsertPaymentInput): Promise<PaymentRecord> {
    const payment = await this.prisma.payment.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        provider: input.provider,
        status: input.status,
        amount: input.amount,
        providerPaymentId: input.providerPaymentId ?? undefined,
        providerOrderId: input.providerOrderId ?? undefined,
        failureReason: input.failureReason ?? undefined,
      },
      update: {
        provider: input.provider,
        status: input.status,
        amount: input.amount,
        providerPaymentId: input.providerPaymentId ?? undefined,
        providerOrderId: input.providerOrderId ?? undefined,
        failureReason: input.failureReason ?? undefined,
      },
    });
    return toPaymentRecord(payment);
  }

  async upsertForSubscription(_input: UpsertSubscriptionPaymentInput): Promise<PaymentRecord> {
    throw new Error('Subscription payments are no longer supported');
  }

  async getByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    return payment ? toPaymentRecord(payment) : null;
  }

  async getBySubscriptionId(_subscriptionId: string): Promise<PaymentRecord | null> {
    return null;
  }

  async listByUserId(userId: string): Promise<PaymentRecord[]> {
    const payments = await (this.prisma as PrismaClient).payment.findMany({
      where: { order: { userId } },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(toPaymentRecord);
  }
}
