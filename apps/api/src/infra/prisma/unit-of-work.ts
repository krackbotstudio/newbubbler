import type { PrismaClient } from '@prisma/client';
import type { UnitOfWork } from '../../application/ports';
import { PrismaOrdersRepo } from './repos/prisma-orders-repo';
import { PrismaInvoicesRepo } from './repos/prisma-invoices-repo';
import { PrismaPaymentsRepo } from './repos/prisma-payments-repo';

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async runInTransaction<T>(
    fn: (repos: import('../../application/ports').TransactionRepos) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repos = {
        ordersRepo: new PrismaOrdersRepo(tx),
        invoicesRepo: new PrismaInvoicesRepo(tx),
        paymentsRepo: new PrismaPaymentsRepo(tx),
      };
      return fn(repos);
    });
  }
}
